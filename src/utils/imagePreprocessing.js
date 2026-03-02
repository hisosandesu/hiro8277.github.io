import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

// 最長辺の上限。2400px で ML Kit / Cloud Vision ともに最適精度を得られる
const MAX_DIMENSION = 2400;

function getImageDimensions(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function preprocessImageForOCR(uri) {
  const { width, height } = await getImageDimensions(uri);
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
