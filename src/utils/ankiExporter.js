import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const CHOICE_LETTERS = ["A", "B", "C", "D"];

/**
 * Ankiフィールド内のタブ・改行を除去する。
 * タブはフィールド区切り文字、改行はカード区切り文字のため、
 * これらが混入するとインポートフォーマットが破壊される。
 */
function sanitizeAnkiField(text) {
  if (text == null) return "";
  return String(text).replace(/[\t\r\n]+/g, " ").trim();
}

/**
 * クイズデータを Anki 互換のタブ区切りテキストとしてエクスポートする。
 * Anki の「ファイルからインポート」でそのまま読み込み可能。
 * フォーマット: 表面\t裏面\n（1行1カード）
 *
 * @param {{ subject: string, questions: object[] }} quiz
 */
export async function exportQuizAsAnkiTxt(quiz) {
  const lines = quiz.questions.map((q) => {
    const front = sanitizeAnkiField(q.question);
    let back = sanitizeAnkiField(q.answer);
    if (q.type === "multiple_choice" && Array.isArray(q.choices)) {
      const choices = q.choices
        .map((c, i) => `${CHOICE_LETTERS[i]}. ${sanitizeAnkiField(c)}`)
        .join("  ");
      back = `${back}\n[${choices}]`;
    }
    if (q.hint) back += `\n💡 ${sanitizeAnkiField(q.hint)}`;
    return `${front}\t${back}`;
  });

  const content = lines.join("\n");
  const subject = (quiz.subject ?? "quiz")
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\.{2,}/g, "_");  // パストラバーサル対策
  const filename = `anki_${subject}_${Date.now()}.txt`;
  const filePath = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(filePath, content);
  await Sharing.shareAsync(filePath, {
    mimeType: "text/plain",
    dialogTitle: "Ankiカードをエクスポート",
  });
}
