import {onRequest} from "firebase-functions/https";
import vision from "@google-cloud/vision";
import {verifyIdToken} from "./middleware/auth.js";

// fallback:true で gRPC ではなく REST を使用する。
// Cloud Run 環境で gRPC 接続が失敗するケースへの対策。
const visionClient = new vision.ImageAnnotatorClient({fallback: true});

export const visionProxy = onRequest({invoker: "public"}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const uid = await verifyIdToken(req, res);
  if (!uid) return;

  const {imageBase64} = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({error: "imageBase64 is required"});
    return;
  }

  try {
    const [result] = await visionClient.documentTextDetection({
      image: {content: imageBase64},
      imageContext: {languageHints: ["ja", "en"]},
    });

    if (result.error?.message) {
      console.error(
        "Cloud Vision API error:", result.error.code, result.error.message,
      );
      res.status(500).json({error: result.error.message});
      return;
    }

    const text = result.fullTextAnnotation?.text ?? "";
    res.json({text});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("visionProxy exception:", message, stack);
    res.status(500).json({error: message});
  }
});
