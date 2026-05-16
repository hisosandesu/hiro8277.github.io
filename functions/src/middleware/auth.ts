import {getAuth} from "firebase-admin/auth";
import {Request, Response} from "express";

/**
 * Authorization ヘッダーの Firebase ID トークンを検証して UID を返す。
 * 検証失敗時は res に 401 を送信して null を返す。
 */
export async function verifyIdToken(
  req: Request,
  res: Response
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({error: "Unauthorized: missing token"});
    return null;
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch (e) {
    const code = (e as {code?: string}).code ?? "unknown";
    const msg = (e as {message?: string}).message ?? "unknown";
    console.error("verifyIdToken failed:", code, msg);
    res.status(401).json({error: `Unauthorized: ${code}`});
    return null;
  }
}
