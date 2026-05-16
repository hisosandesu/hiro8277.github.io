import { getOrCreateAnonymousUser, getIdToken, forceReAuth } from "./authManager";
import { FUNCTIONS_BASE_URL } from "../constants/app";

async function fetchQuizProxy(idToken, quizInput, questionCount) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);
  try {
    return await fetch(`${FUNCTIONS_BASE_URL}/geminiProxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ mode: "quiz", quizInput, questionCount }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 教育モード構造化結果からクイズ問題を生成する。
 * Firebase Functions Proxy 経由で Gemini を呼び出す（APIキーはサーバー管理）。
 *
 * @param {object} structuredResult - geminiOCR.normalizeResult() の EDUCATION 出力
 * @param {number} [questionCount=5] - 生成する問題数
 * @returns {Promise<{ subject: string, questions: object[] }>}
 */
export async function generateQuizFromEducationResult(structuredResult, questionCount = 5) {
  await getOrCreateAnonymousUser();
  let idToken = await getIdToken();
  if (!idToken) throw new Error("認証トークンの取得に失敗しました");

  let response = await fetchQuizProxy(idToken, structuredResult, questionCount);

  if (response.status === 401) {
    await forceReAuth();
    idToken = await getIdToken(true);
    response = await fetchQuizProxy(idToken, structuredResult, questionCount);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Quiz proxy error: ${response.status}`);
  }

  const parsed = await response.json();
  return {
    subject: parsed.subject ?? structuredResult.subject ?? "学習",
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.slice(0, questionCount)
      : [],
  };
}
