import { Platform } from "react-native";

/** 履歴の最大保存件数 */
export const HISTORY_LIMIT = 100;

/** OCR認識結果の最大文字数（超過分は省略） */
export const MAX_TEXT_LENGTH = 5000;

/** クリップボード自動クリアまでの時間（ミリ秒） */
export const CLIPBOARD_CLEAR_DELAY = 30000;

/** OCRエンジン識別子 */
export const OCR_ENGINE = {
  ML_KIT: "ml-kit",
  CLOUD_VISION: "cloud-vision",
  GEMINI_FLASH: "gemini-flash",
  BACKEND: "backend", // 将来: PaddleOCR バックエンド対応時に使用
};

/**
 * Gemini OCR のスキャンモード識別子。
 * GENERAL: 汎用テキスト抽出（構造化なし）
 * RECEIPT: レシート・領収書
 * EDUCATION: 黒板・教科書・試験問題
 */
export const OCR_MODE = {
  GENERAL: "general",
  RECEIPT: "receipt",
  EDUCATION: "education",
};

/**
 * 教育モードの科目識別子。
 * Gemini プロンプトに科目固有の指示を追加するために使用。
 * JAPANESE を選択すると縦書き変換指示が自動付加される。
 */
export const EDUCATION_SUBJECT = {
  GENERAL: "general",
  MATH: "math",
  SCIENCE: "science",
  JAPANESE: "japanese",
  ENGLISH: "english",
  SOCIAL: "social",
};

/**
 * AdMob 広告ユニット ID。
 * Platform.OS で iOS / Android を切り替え。
 * 環境変数未設定時は Google 公式テスト ID にフォールバックする。
 * 本番 ID は EAS Secrets で管理。
 */
export const AD_UNIT_IDS =
  Platform.OS === "ios"
    ? {
        BANNER:
          process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID ??
          "ca-app-pub-3940256099942544/2934735716",
        INTERSTITIAL:
          process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID ??
          "ca-app-pub-3940256099942544/4411468910",
        NATIVE:
          process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID ??
          "ca-app-pub-3940256099942544/3986624511",
      }
    : {
        BANNER:
          process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ??
          "ca-app-pub-3940256099942544/6300978111",
        INTERSTITIAL:
          process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ??
          "ca-app-pub-3940256099942544/1033173712",
        NATIVE:
          process.env.EXPO_PUBLIC_ADMOB_NATIVE_ID ??
          "ca-app-pub-3940256099942544/2247696110",
      };

/** 履歴リストで N 件おきにネイティブ広告を挿入する間隔 */
export const NATIVE_AD_INTERVAL = 5;

/**
 * HistoryScreen の FlatList アイテム高さ（px）。
 * NativeAdCard と共有して getItemLayout の一貫性を保つ。
 * padding32 + header28 + text3行60 + marginBottom12
 */
export const HISTORY_ITEM_HEIGHT = 132;

/** Interstitial 広告の表示頻度（OCR N 回に 1 回表示） */
export const INTERSTITIAL_FREQUENCY = 3;

/** Banner 広告の高さ（px）。ボタン位置オフセットに使用 */
export const BANNER_HEIGHT = 60;

/**
 * 教育モードのクイズ生成問題数。
 * Gemini 無料お試し回数に含まれる。将来プレミアム向けに増やす場合はここを変更。
 */
export const QUIZ_QUESTION_COUNT = 5;

/**
 * Gemini 構造化抽出の無料お試し上限（月単位）。
 * Phase 3（RevenueCat）実装後はプレミアムユーザーにはこの制限を適用しない。
 */
export const GEMINI_FREE_TRIAL_LIMIT = 50;

/**
 * プレミアムユーザーの Gemini 月間使用上限。
 * "実質無制限" の体験を提供しつつコスト暴走を防ぐ安全弁。
 * 1回あたり約¥0.3〜0.8 と仮定すると 200回 = 約¥60〜160（月額¥480 の収益に対して余裕あり）。
 * 環境変数 EXPO_PUBLIC_GEMINI_PREMIUM_MONTHLY_LIMIT で上書き可能。
 */
export const GEMINI_PREMIUM_MONTHLY_LIMIT = parseInt(
  process.env.EXPO_PUBLIC_GEMINI_PREMIUM_MONTHLY_LIMIT ?? "200",
  10,
);

/**
 * Gemini API 1日あたりのフロントエンド使用上限。
 * 無料枠は1日1,500リクエストだが、保守的な上限として100を設定。
 * 環境変数 EXPO_PUBLIC_GEMINI_DAILY_LIMIT で上書き可能。
 */
export const GEMINI_DAILY_LIMIT = parseInt(
  process.env.EXPO_PUBLIC_GEMINI_DAILY_LIMIT ?? "100",
  10,
);

/**
 * Cloud Vision API 1日あたりのフロントエンド使用上限。
 * 環境変数 EXPO_PUBLIC_CLOUD_VISION_DAILY_LIMIT で上書き可能（デフォルト: 30）。
 * Google Cloud Console のクォータ設定と組み合わせて使用すること。
 */
export const CLOUD_VISION_DAILY_LIMIT = parseInt(
  process.env.EXPO_PUBLIC_CLOUD_VISION_DAILY_LIMIT ?? "30",
  10,
);
