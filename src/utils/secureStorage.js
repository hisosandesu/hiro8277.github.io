import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * AsyncStorage ラッパー（OCR 履歴専用・非暗号化）。
 * expo-secure-store はキー文字制限 (英数字・"."・"-"・"_" のみ) と
 * 値サイズ制限 (2048 bytes) があり OCR 履歴の保存に不適なため、
 * AsyncStorage を使用する。OCR 履歴はユーザー生成テキストであり機密情報ではない。
 * 将来の認証トークン等の機密情報には expo-secure-store を直接使用すること。
 */
export const AppStorage = {
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
