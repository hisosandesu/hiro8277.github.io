import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions";

// Firebase Admin SDK を一度だけ初期化（Functions 実行環境では ADC が自動適用）
initializeApp();

setGlobalOptions({
  region: "asia-northeast1",
  maxInstances: 10,
});

export {geminiProxy} from "./geminiProxy.js";
export {visionProxy} from "./visionProxy.js";
export {revenueCatWebhook} from "./webhooks.js";
