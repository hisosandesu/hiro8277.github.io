// 記号・罫線のみの行（意味のあるテキストを含まない）
const NOISE_ONLY_PATTERN = /^[\s\-─—|＝=・…※◆▼▶◎●○■□△▲]+$/;
// 句読点のみの行
const PUNCTUATION_ONLY_PATTERN = /^[。、！？!?.,\s]+$/;

export function filterOCRResult(text) {
  if (!text) return "";

  const filtered = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      if (trimmed.length === 1) return false;
      if (NOISE_ONLY_PATTERN.test(trimmed)) return false;
      if (PUNCTUATION_ONLY_PATTERN.test(trimmed)) return false;
      return true;
    })
    .join("\n");

  // 3行以上連続する空行を最大2行に正規化
  return filtered.replace(/\n{3,}/g, "\n\n").trim();
}
