import * as Sentry from "@sentry/react-native";

let _initialized = false;

/**
 * Sentry を初期化する。EXPO_PUBLIC_SENTRY_DSN が未設定の場合はスキップ。
 * App.js のトップレベルで一度だけ呼び出す。
 */
export function initMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    debug: __DEV__,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 10000,
    tracesSampleRate: __DEV__ ? 0 : 1.0,
  });

  _initialized = true;
}

/**
 * エラーを Sentry に送信する。
 * 開発環境・DSN 未設定時は何もしない（console には出力しない）。
 */
export function captureError(error, context) {
  if (__DEV__ || !_initialized) return;
  try {
    Sentry.captureException(error, { extra: context });
  } catch (_e) {
    // Sentry 送信失敗はアプリの動作に影響させない
  }
}
