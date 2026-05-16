import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

// 最長辺の上限。2400px で ML Kit / Cloud Vision ともに最適精度を得られる
const MAX_DIMENSION = 2400;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — これを超えるとbase64展開でOOMリスク
const MAX_ASPECT_RATIO = 20; // 超横長・超縦長画像はOCRにも不適

function getImageDimensions(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function preprocessImageForOCR(uri) {
  // ファイルサイズチェック（大きすぎる画像はbase64展開でメモリ枯渇の原因になる）
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (info.exists && info.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const { width, height } = await getImageDimensions(uri);

  // 極端なアスペクト比はOCR精度が極めて低く、処理コストも無駄になる
  if (width > 0 && height > 0) {
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    if (aspectRatio > MAX_ASPECT_RATIO) {
      throw new Error("IMAGE_INVALID_ASPECT");
    }
  }
  const actions = [];

  // 最長辺が MAX_DIMENSION を超える場合のみ縮小（縦横問わず適切にリサイズ）
  const longestSide = Math.max(width, height);
  if (longestSide > MAX_DIMENSION) {
    actions.push(
      width >= height
        ? { resize: { width: MAX_DIMENSION } }
        : { resize: { height: MAX_DIMENSION } }
    );
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.95, // 0.9 → 0.95: JPEG劣化を抑えテキスト境界を鮮明に保持
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return result.uri;
}
