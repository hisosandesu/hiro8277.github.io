import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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
import { SecureStorage } from "../utils/secureStorage";
import { captureError } from "../utils/monitoring";
import { HISTORY_KEY } from "../constants/storage";
import { COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import { HISTORY_LIMIT, MAX_TEXT_LENGTH } from "../constants/app";

export default function HomeScreen({ navigation }) {
  const [image, setImage] = useState("");
  const [text, setText] = useState("");

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

  const openCamera = async () => {
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
  };

  const recognizeText = async () => {
    if (image) {
      try {
        const processedUri = await preprocessImageForOCR(image);
        const result = await TextRecognition.recognize(
          processedUri,
          TextRecognitionScript.JAPANESE
        );
        if (result) {
          const filtered = filterOCRResult(result.text);
          if (filtered.length > MAX_TEXT_LENGTH) {
            setText(filtered.slice(0, MAX_TEXT_LENGTH));
            Alert.alert(
              MESSAGES.INFO.TEXT_TRUNCATED_TITLE,
              MESSAGES.INFO.TEXT_TRUNCATED_BODY
            );
          } else {
            setText(filtered);
          }
        }
      } catch (error) {
        captureError(error, { screen: "HomeScreen", action: "recognizeText" });
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.OCR_FAILED);
      }
    }
  };

  const clearResult = () => {
    setImage("");
    setText("");
  };

  const saveToHistory = async () => {
    if (!text) {
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.NO_TEXT);
      return;
    }

    try {
      const jsonValue = await SecureStorage.getItem(HISTORY_KEY);
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

      await SecureStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(newHistory.slice(0, HISTORY_LIMIT))
      );

      Alert.alert(MESSAGES.SUCCESS.SAVE_TITLE, MESSAGES.SUCCESS.SAVE_BODY);
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "saveToHistory" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.SAVE_FAILED);
    }
  };

  useEffect(() => {
    if (image) {
      recognizeText();
    }
  }, [image]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          {text ? (
            <View style={styles.textContainer}>
              <Text style={styles.textContent}>{text}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <FloatingButton onPress={openCamera} />
      {text ? <SaveButton onPress={saveToHistory} /> : null}
      {text ? <ClearButton onPress={clearResult} /> : null}
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
    justifyContent: "center",
    padding: 16,
  },
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
  textContent: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    textAlign: "justify",
  },
});
