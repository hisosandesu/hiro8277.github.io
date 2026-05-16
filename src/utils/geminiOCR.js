import * as FileSystem from "expo-file-system/legacy";
import { getOrCreateAnonymousUser, getIdToken, forceReAuth } from "./authManager";
import { OCR_MODE, FUNCTIONS_BASE_URL } from "../constants/app";

/**
 * Firebase Functions の geminiProxy が利用可能かを確認する。
 * サーバー側で API キーを管理するため、クライアント側のキー設定は不要。
 */
export function isGeminiAvailable() {
  return !!FUNCTIONS_BASE_URL;
}

/**
 * Firebase Functions 経由で Gemini OCR を実行する。
 * 画像の base64 変換・送信のみ担当し、プロンプトと API 呼び出しはサーバー側で処理。
 *
 * @param {string} imageUri - 前処理済み画像の file:// URI
 * @param {string} [mode=OCR_MODE.GENERAL] - OCR_MODE 定数
 * @param {object} [options={}] - 追加オプション（subject など）
 * @returns {Promise<object>} raw_text を必ず含む構造化結果
 */
// AbortSignal.timeout() は Hermes 未対応のため AbortController + setTimeout を使用
async function fetchGeminiProxy(idToken, imageBase64, mimeType, mode, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);
  try {
    return await fetch(`${FUNCTIONS_BASE_URL}/geminiProxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ imageBase64, mimeType, mode, options }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function recognizeTextWithGemini(imageUri, mode = OCR_MODE.GENERAL, options = {}) {
  await getOrCreateAnonymousUser();
  let idToken = await getIdToken();
  if (!idToken) {
    throw new Error("認証トークンの取得に失敗しました");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: "base64",
  });

  let response = await fetchGeminiProxy(idToken, base64Image, "image/jpeg", mode, options);

  // 401: stale/wrong-project token → force re-auth and retry once
  if (response.status === 401) {
    await forceReAuth();
    idToken = await getIdToken(true);
    if (!idToken) throw new Error("再認証に失敗しました");
    response = await fetchGeminiProxy(idToken, base64Image, "image/jpeg", mode, options);
  }

  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const body = await response.json();
      detail = `${response.status}: ${body.error ?? JSON.stringify(body)}`;
    } catch { /* response body parse failed */ }
    throw new Error(`Gemini proxy error: ${detail}`);
  }

  return response.json();
}
