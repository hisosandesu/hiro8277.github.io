import * as ImageManipulator from "expo-image-manipulator";

const MAX_DIMENSION = 1920;

export async function preprocessImageForOCR(uri) {
  const actions = [{ resize: { width: MAX_DIMENSION } }];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return result.uri;
}
