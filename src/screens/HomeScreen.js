import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Alert,
  PermissionsAndroid,
  TouchableOpacity,
} from "react-native";

import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import TextRecognition, {
  TextRecognitionScript,
} from "@react-native-ml-kit/text-recognition";

import Icon from "@react-native-vector-icons/fontawesome6";
import FloatingButton from "../components/FloatingButton";
import ClearButton from "../components/ClearButton";
import SaveButton from "../components/SaveButton";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "@ocr_history";

export default function HomeScreen({ navigation }) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => {
        return (
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              style={{ marginRight: 15 }}
              onPress={() => navigation.navigate("History")}
            >
              <Icon name="circle-right" color={"white"} size={25} solid />
            </TouchableOpacity>
            <TouchableOpacity style={{ marginRight: 15 }} onPress={pickImage}>
              <Icon name="folder" color={"white"} size={25} solid />
            </TouchableOpacity>
          </View>
        );
      },
    });
  }, []);

  const isDarkMode = useColorScheme() === "dark";
  const [image, setImage] = useState("");
  const [text, setText] = useState("");

  const pickImage = async () => {
    let result = await launchImageLibrary({ mediaType: "photo" });
    if (result && result.assets && result.assets.length > 0) {
      console.log("📸 撮影/選択した画像:", result.assets[0].uri);
      setImage(result.assets[0].uri);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "カメラアクセス許可",
          message: "OCR機能のためにカメラを使用します。",
          buttonNeutral: "あとで",
          buttonNegative: "拒否",
          buttonPositive: "許可",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert("エラー", "カメラ権限がありません。");
      return;
    }

    try {
      const result = await launchCamera({ mediaType: "photo" });
      if (result.didCancel) return;
      if (result.errorCode) {
        console.log("ImagePicker Error: ", result.errorMessage);
        return;
      }
      if (result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("launchCamera failed:", error);
    }
  };

  const recognizeText = async () => {
    if (image) {
      try {
        const result = await TextRecognition.recognize(
          image,
          TextRecognitionScript.JAPANESE // 👈 日本語スクリプトを指定
        );
        if (result) {
          setText(result.text);
          console.log("📄 認識したテキスト:", result.text);
        }
      } catch (err) {
        console.error("TextRecognition error:", err);
        Alert.alert("エラー", "テキスト認識に失敗しました");
      }
    }
  };

  const clearResult = () => {
    setImage("");
    setText("");
    console.log("🧹 結果をクリアしました");
  };

  const saveToHistory = async () => {
    if (!text) {
      Alert.alert("エラー", "保存するテキストがありません");
      return;
    }

    try {
      // 既存の履歴を取得
      const jsonValue = await AsyncStorage.getItem(HISTORY_KEY);
      const history = jsonValue != null ? JSON.parse(jsonValue) : [];

      // 新しい履歴項目を作成
      const newItem = {
        id: Date.now().toString(),
        text: text,
        date: Date.now(),
      };

      // 履歴の先頭に追加
      const newHistory = [newItem, ...history];

      // 履歴を保存（最大100件まで）
      await AsyncStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(newHistory.slice(0, 100))
      );

      console.log("💾 履歴に保存しました:", newItem.id);
      Alert.alert("保存完了", "テキストを履歴に保存しました");
    } catch (e) {
      console.error("履歴の保存エラー:", e);
      Alert.alert("エラー", "履歴の保存に失敗しました");
    }
  };

  useEffect(() => {
    recognizeText();
  }, [image]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          <Text>OCR テスト</Text>
          <View style={{ flexDirection: "row", marginVertical: 16 }}>
            <Button onPress={pickImage} title="画像を選択" />
            <Button onPress={openCamera} title="カメラ起動" />
          </View>
          <View>
            <Text style={{ textAlign: "justify", fontSize: 10, padding: 16 }}>
              {text}
            </Text>
          </View>
        </View>
        <FloatingButton onPress={openCamera}></FloatingButton>
        {text ? <SaveButton onPress={saveToHistory}></SaveButton> : null}
        {text ? <ClearButton onPress={clearResult}></ClearButton> : null}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7", // 全体の背景色
  },
  scroll: {
    flexGrow: 1, // ScrollView 全体に色を適用するため
    backgroundColor: "#f2f2f7",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
