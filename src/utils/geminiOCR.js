// expo-file-system v19（SDK 54）では legacy サブパスで旧APIを使用
import * as FileSystem from "expo-file-system/legacy";
// @google/genai: Metro bundler は "browser" 条件を解決するため
// Node.js 固有API（fs, path等）を含まない Web 版バンドルが自動選択される
import { GoogleGenAI } from "@google/genai";

/** 使用するモデル。URL文字列ではなく定数で管理することでモデル変更が1箇所で完結 */
const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Gemini API キーが設定されているかを確認する。
 * EXPO_PUBLIC_ プレフィックスによりビルド時に埋め込まれる。
 */
export function isGeminiAvailable() {
  return !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;
}

/**
 * Gemini 2.5 Flash でテキスト認識＋構造化情報抽出を実行する。
 *
 * - @google/genai 新SDK（2025年リリース）を使用
 * - マルチモーダル入力（テキストプロンプト＋base64画像）を1リクエストで送信
 * - config.responseMimeType: "application/json" でJSON純粋出力を強制
 * - レシート以外の文書もそのままOCRテキストとして返す（raw_text）
 *
 * @param {string} imageUri - 前処理済み画像の file:// URI
 * @returns {Promise<{ raw_text: string, merchant: string|null, date: string|null, total: string|null, tax: string|null, items: Array }>}
 * @throws {Error} API キー未設定 / タイムアウト / API エラー
 */
export async function recognizeTextWithGemini(imageUri) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: "base64",
  });

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `画像内のすべてのテキストを正確に読み取り、以下のJSON形式で返してください。
レシート・領収書の場合は各フィールドを埋めてください。
それ以外の文書の場合は raw_text のみ埋め、他は null にしてください。

{
  "raw_text": "画像内の全テキスト（改行を保持）",
  "merchant": "店名（レシートの場合）",
  "date": "日付（YYYY-MM-DD形式、レシートの場合）",
  "total": "合計金額（数字のみ、レシートの場合）",
  "tax": "消費税額（数字のみ、レシートの場合）",
  "items": [
    { "name": "商品名", "price": "金額（数字のみ）", "quantity": "数量" }
  ]
}`;

  // SDK は AbortController を直接受け取らないため Promise.race でタイムアウトを実装
  // （AbortSignal.timeout() は Hermes 未対応のため setTimeout を使う）
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gemini API timeout after 30s")), 30000),
  );

  const generatePromise = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const response = await Promise.race([generatePromise, timeoutPromise]);

  // 新SDK: response.text は candidates[0].content.parts[0].text のショートカットゲッター
  const responseText = response.text ?? "";

  if (!responseText) {
    return {
      raw_text: "",
      merchant: null,
      date: null,
      total: null,
      tax: null,
      items: [],
    };
  }

  try {
    const parsed = JSON.parse(responseText);
    return {
      raw_text: parsed.raw_text ?? "",
      merchant: parsed.merchant ?? null,
      date: parsed.date ?? null,
      total: parsed.total ?? null,
      tax: parsed.tax ?? null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    // JSON パース失敗時は全テキストを raw_text として返す（フォールバック）
    return {
      raw_text: responseText,
      merchant: null,
      date: null,
      total: null,
      tax: null,
      items: [],
    };
  }
}
