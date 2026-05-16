import * as FileSystem from "expo-file-system/legacy";
import { getOrCreateAnonymousUser, getIdToken, forceReAuth } from "./authManager";
import { FUNCTIONS_BASE_URL } from "../constants/app";

/**
 * Cloud Vision API のレート制限（429）専用エラー。
 * 呼び出し側で instanceof による種別判定に使用する。
 */
export class CloudVisionRateLimitError extends Error {
  constructor() {
    super("Cloud Vision API rate limit exceeded (429)");
    this.name = "CloudVisionRateLimitError";
  }
}

/**
 * Firebase Functions の visionProxy が利用可能かを確認する。
 * サーバー側でサービスアカウント認証するため、クライアント側のキー設定は不要。
 */
export function isCloudVisionAvailable() {
  return !!FUNCTIONS_BASE_URL;
}

/**
 * Firebase Functions 経由で Cloud Vision OCR を実行する。
 * サーバー側でサービスアカウント（ADC）を使って認証するため API キー不要。
 *
 * @param {string} imageUri - 前処理済み画像の file:// URI
 * @returns {Promise<string>} 認識テキスト（空の場合は空文字列）
 */
// AbortSignal.timeout() は Hermes 未対応のため AbortController + setTimeout を使用
async function fetchVisionProxy(idToken, imageBase64) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);
  try {
    return await fetch(`${FUNCTIONS_BASE_URL}/visionProxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function recognizeTextWithCloudVision(imageUri) {
  await getOrCreateAnonymousUser();
  let idToken = await getIdToken();
  if (!idToken) {
    throw new Error("認証トークンの取得に失敗しました");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: "base64",
  });

  let response = await fetchVisionProxy(idToken, base64Image);

  // 401: stale/wrong-project token → force re-auth and retry once
  if (response.status === 401) {
    await forceReAuth();
    idToken = await getIdToken(true);
    if (!idToken) throw new Error("再認証に失敗しました");
    response = await fetchVisionProxy(idToken, base64Image);
  }

  if (!response.ok) {
    if (response.status === 429) throw new CloudVisionRateLimitError();
    throw new Error(`Vision proxy error: ${response.status}`);
  }

  const data = await response.json();
  return data.text ?? "";
}
