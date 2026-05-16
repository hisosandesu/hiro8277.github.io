import {onRequest} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import {getFirestore} from "firebase-admin/firestore";

const webhookSecret = defineSecret("REVENUECAT_WEBHOOK_SECRET");

// RevenueCat から届くイベント型（抜粋）
const PURCHASE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
]);
const REVOKE_EVENTS = new Set([
  "EXPIRATION",
  "CANCELLATION",
  "BILLING_ISSUE",
]);

export const revenueCatWebhook = onRequest(
  {secrets: [webhookSecret]},
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    // RevenueCat 署名検証（Authorization: Bearer <SECRET>）
    if (req.headers.authorization !== `Bearer ${webhookSecret.value()}`) {
      res.status(401).json({error: "Unauthorized"});
      return;
    }

    const body = req.body as {
      event?: { type?: string; app_user_id?: string };
    };
    const eventType = body.event?.type;
    const appUserId = body.event?.app_user_id;

    if (!appUserId) {
      res.status(400).json({error: "Missing app_user_id"});
      return;
    }

    const db = getFirestore();
    const userRef = db.collection("users").doc(appUserId);

    if (PURCHASE_EVENTS.has(eventType ?? "")) {
      await userRef.set({isPremium: true}, {merge: true});
    } else if (REVOKE_EVENTS.has(eventType ?? "")) {
      await userRef.set({isPremium: false}, {merge: true});
    }
    // 未知イベントは無視して 200 を返す

    res.json({received: true});
  }
);
