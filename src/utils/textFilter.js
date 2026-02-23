export function filterOCRResult(text) {
  if (!text) return "";

  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      if (trimmed.length === 1) return false;
      return true;
    })
    .join("\n")
    .trim();
}
