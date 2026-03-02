import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import TextRecognition, {
  TextRecognitionScript,
} from "@react-native-ml-kit/text-recognition";

import Icon from "@react-native-vector-icons/fontawesome6";
import FloatingButton from "../components/FloatingButton";
import ClearButton from "../components/ClearButton";
import SaveButton from "../components/SaveButton";
import { preprocessImageForOCR } from "../utils/imagePreprocessing";
import { filterOCRResult } from "../utils/textFilter";
import {
  isCloudVisionAvailable,
  recognizeTextWithCloudVision,
} from "../utils/cloudVisionOCR";
import { AppStorage } from "../utils/secureStorage";
import { captureError } from "../utils/monitoring";
import { HISTORY_KEY } from "../constants/storage";
import { COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import { HISTORY_LIMIT, MAX_TEXT_LENGTH } from "../constants/app";

export default function HomeScreen({ navigation }) {
  const [image, setImage] = useState("");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false); // 3-B: OCR処理中フラグ
  const [isEditing, setIsEditing] = useState(false); // 3-C: テキスト編集モード
  const [engineUsed, setEngineUsed] = useState(null); // 3-D: 使用エンジン ('cloud-vision' | 'ml-kit' | null)
  const [processedUri, setProcessedUri] = useState(null); // 前処理済み画像URIキャッシュ（高精度再認識時の二重処理防止）

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity style={{ marginLeft: 15 }} onPress={pickImage}>
          <Icon name="folder" color={COLORS.white} size={25} solid />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={() => navigation.navigate("History")}
        >
          <Icon name="circle-right" color={COLORS.white} size={25} solid />
        </TouchableOpacity>
      ),
    });
  }, [navigation, pickImage]);

  const openCamera = useCallback(async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.CAMERA_PERMISSION);
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "openCamera" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.CAMERA_LAUNCH);
    }
  }, []);

  const applyOCRResult = useCallback((rawText) => {
    const filtered = filterOCRResult(rawText);
    if (filtered.length > MAX_TEXT_LENGTH) {
      setText(filtered.slice(0, MAX_TEXT_LENGTH));
      Alert.alert(MESSAGES.INFO.TEXT_TRUNCATED_TITLE, MESSAGES.INFO.TEXT_TRUNCATED_BODY);
    } else {
      setText(filtered);
    }
  }, []);

  const recognizeText = useCallback(async () => {
    if (!image) return;

    setIsLoading(true);
    setIsEditing(false);
    setEngineUsed(null);
    try {
      const uri = await preprocessImageForOCR(image);
      setProcessedUri(uri); // 高精度再認識ボタン用にキャッシュ
      let rawText = "";

      if (isCloudVisionAvailable()) {
        try {
          rawText = await recognizeTextWithCloudVision(uri);
          setEngineUsed("cloud-vision");
        } catch (cloudError) {
          captureError(cloudError, {
            screen: "HomeScreen",
            action: "cloudVisionOCR",
          });
          const result = await TextRecognition.recognize(
            uri,
            TextRecognitionScript.JAPANESE
          );
          rawText = result?.text ?? "";
          setEngineUsed("ml-kit");
        }
      } else {
        const result = await TextRecognition.recognize(
          uri,
          TextRecognitionScript.JAPANESE
        );
        rawText = result?.text ?? "";
        setEngineUsed("ml-kit");
      }

      applyOCRResult(rawText);
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "recognizeText" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.OCR_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [image, applyOCRResult]);

  const recognizeTextHighPrecision = useCallback(async () => {
    if (!image || !isCloudVisionAvailable()) return;

    setIsLoading(true);
    setIsEditing(false);
    try {
      // recognizeText 実行済みの場合は前処理済みURIを再利用（二重処理防止）
      const uri = processedUri ?? await preprocessImageForOCR(image);
      const rawText = await recognizeTextWithCloudVision(uri);
      setEngineUsed("cloud-vision");
      applyOCRResult(rawText);
    } catch (error) {
      captureError(error, {
        screen: "HomeScreen",
        action: "recognizeTextHighPrecision",
      });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.HIGH_PRECISION_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [image, processedUri, applyOCRResult]);

  const clearResult = useCallback(() => {
    setImage("");
    setText("");
    setIsEditing(false);
    setEngineUsed(null);
    setProcessedUri(null);
  }, []);

  const saveToHistory = useCallback(async () => {
    if (!text) {
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.NO_TEXT);
      return;
    }

    try {
      const jsonValue = await AppStorage.getItem(HISTORY_KEY);
      let history = [];
      try {
        history = jsonValue != null ? JSON.parse(jsonValue) : [];
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        history = [];
      }

      const newItem = {
        id: Crypto.randomUUID(),
        text: text,
        date: Date.now(),
      };

      const newHistory = [newItem, ...history];

      await AppStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(newHistory.slice(0, HISTORY_LIMIT))
      );

      Alert.alert(MESSAGES.SUCCESS.SAVE_TITLE, MESSAGES.SUCCESS.SAVE_BODY);
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "saveToHistory" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.SAVE_FAILED);
    }
  }, [text]);

  const toggleEdit = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  useEffect(() => {
    if (image) {
      recognizeText();
    }
  }, [image, recognizeText]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>

          {/* 3-A: 画像プレビュー — 選択直後から表示（OCR処理中も表示し続ける） */}
          {image ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: image }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
            </View>
          ) : null}

          {/* 3-B: ローディング表示 */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>認識中...</Text>
            </View>
          ) : null}

          {/* OCR結果 + 3-C: 手動編集トグル */}
          {text && !isLoading ? (
            <View style={styles.textContainer}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={toggleEdit}
              >
                <Icon
                  name={isEditing ? "check" : "pen"}
                  color={COLORS.primary}
                  size={14}
                  solid
                />
                <Text style={styles.editButtonLabel}>
                  {isEditing ? "完了" : "編集"}
                </Text>
              </TouchableOpacity>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={text}
                  onChangeText={setText}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              ) : (
                <Text style={styles.textContent}>{text}</Text>
              )}
            </View>
          ) : null}

          {/* 3-D: 高精度再認識ボタン（ML Kit使用時のみ表示） */}
          {text && !isLoading && engineUsed === "ml-kit" && isCloudVisionAvailable() ? (
            <TouchableOpacity
              style={styles.highPrecisionButton}
              onPress={recognizeTextHighPrecision}
            >
              <Icon name="arrows-rotate" color={COLORS.white} size={12} solid />
              <Text style={styles.highPrecisionButtonLabel}>高精度で再認識</Text>
            </TouchableOpacity>
          ) : null}

        </View>
      </ScrollView>
      <FloatingButton onPress={openCamera} />
      {text && !isLoading ? <SaveButton onPress={saveToHistory} /> : null}
      {text && !isLoading ? <ClearButton onPress={clearResult} /> : null}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 16,
  },
  // 3-A: 画像プレビュー
  imageContainer: {
    width: "100%",
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  imagePreview: {
    width: "100%",
    height: 200,
  },
  // 3-B: ローディング
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    width: "100%",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // OCR結果テキストエリア
  textContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: "100%",
  },
  // 3-C: 編集ボタン
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonLabel: {
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.primary,
  },
  textContent: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    textAlign: "justify",
  },
  // 3-C: 編集時 TextInput（Text と同じフォントスタイル）
  textInput: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    minHeight: 100,
    textAlignVertical: "top",
  },
  // 3-D: 高精度再認識ボタン
  highPrecisionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    alignSelf: "center",
  },
  highPrecisionButtonLabel: {
    marginLeft: 6,
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "600",
  },
});
