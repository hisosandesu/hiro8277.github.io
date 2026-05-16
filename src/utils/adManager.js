import {
  InterstitialAd,
  AdEventType,
} from "react-native-google-mobile-ads";
import { captureError } from "./monitoring";
import { AD_UNIT_IDS, INTERSTITIAL_FREQUENCY } from "../constants/app";

// Interstitial インスタンスをモジュールスコープで保持（シングルトン）
const interstitial = InterstitialAd.createForAdRequest(
  AD_UNIT_IDS.INTERSTITIAL,
  { requestNonPersonalizedAdsOnly: false },
);

let loaded = false;
let ocrCount = 0; // OCR 実行回数カウンター（アプリ再起動でリセット）
let unsubscribeLoaded = null;
let unsubscribeClosed = null;
let unsubscribeError = null;

/**
 * Interstitial 広告を初期化してプリロードする。
 * HomeScreen の useEffect で呼び出す。
 */
export function initializeInterstitial() {
  unsubscribeLoaded = interstitial.addAdEventListener(
    AdEventType.LOADED,
    () => {
      loaded = true;
    },
  );

  unsubscribeClosed = interstitial.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      // 広告を閉じた後、次の広告を自動プリロード
      loaded = false;
      interstitial.load();
    },
  );

  unsubscribeError = interstitial.addAdEventListener(
    AdEventType.ERROR,
    (error) => {
      loaded = false;
      captureError(error, { context: "InterstitialAd", action: "load" });
    },
  );

  interstitial.load();
}

/**
 * OCR 完了時に呼び出す。INTERSTITIAL_FREQUENCY 回に 1 回 Interstitial を表示する。
 * 広告未ロード時はスキップ（ユーザー体験を優先）。
 */
export function showInterstitialIfReady() {
  ocrCount += 1;
  if (ocrCount % INTERSTITIAL_FREQUENCY === 0 && loaded) {
    interstitial.show();
  }
}

/**
 * 頻度カウンターに依存せず、ロード済みであれば即座に Interstitial を表示する。
 * 「AIで再認識」ボタンなど、特定アクションに紐付けて広告を見せたい場合に使用。
 * 未ロード時はスキップ（広告でUXをブロックしない）。
 */
export function showInterstitialNow() {
  if (loaded) {
    interstitial.show();
  }
}

/**
 * イベントリスナーを解除する。
 * HomeScreen の useEffect クリーンアップで呼び出す。
 */
export function cleanupInterstitial() {
  unsubscribeLoaded?.();
  unsubscribeClosed?.();
  unsubscribeError?.();
}
