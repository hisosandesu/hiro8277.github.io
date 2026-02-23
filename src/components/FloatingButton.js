import { StyleSheet } from "react-native";
import ActionButton from "./ActionButton";

export default function FloatingButton({ onPress }) {
  return <ActionButton onPress={onPress} iconName="square-plus" style={styles.position} />;
}

const styles = StyleSheet.create({
  position: { right: 30, bottom: 30 },
});
