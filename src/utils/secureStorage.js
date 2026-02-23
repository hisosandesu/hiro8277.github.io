import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * AsyncStorage ラッパー。
 * expo-secure-store はキー文字制限 (英数字・"."・"-"・"_" のみ) と
 * 値サイズ制限 (2048 bytes) があり OCR 履歴の保存に不適なため、
 * AsyncStorage を使用する。
 */
export const SecureStorage = {
  async getItem(key) {
    return AsyncStorage.getItem(key);
  },

  async setItem(key, value) {
    return AsyncStorage.setItem(key, value);
  },

  async removeItem(key) {
    return AsyncStorage.removeItem(key);
  },
};
