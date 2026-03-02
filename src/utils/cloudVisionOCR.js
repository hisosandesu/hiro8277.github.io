// expo-file-system v17 (SDK 54) では readAsStringAsync は legacy API に移行済み
// 新API: "expo-file-system/next" の File クラス。現時点では legacy で動作を維持。
import * as FileSystem from "expo-file-system/legacy";

const CLOUD_VISION_API_URL =
  "https://vision.googleapis.com/v1/images:annotate";

/**
 * Cloud Vision API キーが設定されているかを確認する。
 * EXPO_PUBLIC_ プレフィックスによりビルド時に埋め込まれる。
 */
export function isCloudVisionAvailable() {
  return !!process.env.EXPO_PUBLIC_CLOUD_VISION_API_KEY;
}

/**
 * Google Cloud Vision API (DOCUMENT_TEXT_DETECTION) でテキスト認識を実行する。
 * - DOCUMENT_TEXT_DETECTION: レイアウト構造を保持。日本語縦書き・段落認識に最適。
 * - languageHints: ['ja', 'en'] で日英混在文書の認識精度を向上。
 *
 * @param {string} imageUri - 前処理済み画像の file:// URI
 * @returns {Promise<string>} 認識テキスト（空の場合は空文字列）
 * @throws {Error} API キー未設定 / HTTP エラー / API エラー
 */
export async function recognizeTextWithCloudVision(imageUri) {
  const apiKey = process.env.EXPO_PUBLIC_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("Cloud Vision API key is not configured");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: "base64",
  });

  const response = await fetch(`${CLOUD_VISION_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
          imageContext: { languageHints: ["ja", "en"] },
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Cloud Vision API HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.responses?.[0]?.error) {
    throw new Error("Cloud Vision API returned an error");
  }

  return data.responses?.[0]?.fullTextAnnotation?.text ?? "";
}
