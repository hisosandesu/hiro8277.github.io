import { AppStorage } from "./secureStorage";

const USAGE_KEY = "cv_daily_usage";
const GEMINI_USAGE_KEY = "gemini_daily_usage";
/** 月をまたいだ無料お試し回数の追跡キー（"YYYY-M" 形式でキーイング） */
const GEMINI_TRIAL_KEY = "gemini_monthly_trial";

/**
 * 今日の Cloud Vision API 使用回数を取得する。
 * @returns {Promise<number>}
 */
export async function getCloudVisionUsageToday() {
  try {
    const raw = await AppStorage.getItem(USAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const today = new Date().toDateString();
    return data[today] ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Cloud Vision API 使用回数を 1 増やす。
 * 失敗してもOCR処理を止めないため例外を握りつぶす。
 * 今日以外の古い日付データは自動削除してストレージサイズを抑える。
 */
export async function incrementCloudVisionUsage() {
  try {
    const raw = await AppStorage.getItem(USAGE_KEY);
    const today = new Date().toDateString();
    const prev = raw ? JSON.parse(raw) : {};
    // 今日のカウントのみ保持（前日以前のデータを削除）
    const updated = { [today]: (prev[today] ?? 0) + 1 };
    await AppStorage.setItem(USAGE_KEY, JSON.stringify(updated));
  } catch {
    // カウント失敗は無視（OCR処理を優先）
  }
}

/**
 * 今日の Gemini API 使用回数を取得する。
 * @returns {Promise<number>}
 */
export async function getGeminiUsageToday() {
  try {
    const raw = await AppStorage.getItem(GEMINI_USAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const today = new Date().toDateString();
    return data[today] ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Gemini API 使用回数を 1 増やす。
 * 失敗してもOCR処理を止めないため例外を握りつぶす。
 */
export async function incrementGeminiUsage() {
  try {
    const raw = await AppStorage.getItem(GEMINI_USAGE_KEY);
    const today = new Date().toDateString();
    const prev = raw ? JSON.parse(raw) : {};
    const updated = { [today]: (prev[today] ?? 0) + 1 };
    await AppStorage.setItem(GEMINI_USAGE_KEY, JSON.stringify(updated));
  } catch {
    // カウント失敗は無視（OCR処理を優先）
  }
}

/**
 * 今月の Gemini 無料お試し使用回数を取得する。
 * 月をまたぐと自動的に 0 にリセットされる。
 * @returns {Promise<number>}
 */
export async function getGeminiTrialUsedThisMonth() {
  try {
    const raw = await AppStorage.getItem(GEMINI_TRIAL_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const d = new Date();
    const thisMonth = `${d.getFullYear()}-${d.getMonth()}`;
    return data[thisMonth] ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 今月の Gemini 無料お試し回数を 1 増やす。
 * 今月以外の古い月のデータは自動削除する。
 */
export async function incrementGeminiTrialUsage() {
  try {
    const d = new Date();
    const thisMonth = `${d.getFullYear()}-${d.getMonth()}`;
    const raw = await AppStorage.getItem(GEMINI_TRIAL_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    const updated = { [thisMonth]: (existing[thisMonth] ?? 0) + 1 };
    await AppStorage.setItem(GEMINI_TRIAL_KEY, JSON.stringify(updated));
  } catch {
    // カウント失敗は無視（OCR処理を優先）
  }
}
