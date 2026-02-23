import { StyleSheet } from "react-native";
import ActionButton from "./ActionButton";

export default function SaveButton({ onPress }) {
  return <ActionButton onPress={onPress} iconName="floppy-disk" style={styles.position} />;
}

const styles = StyleSheet.create({
  position: { left: 30, bottom: 30 },
});
