import { StyleSheet } from "react-native";
import ActionButton from "./ActionButton";

export default function ClearButton({ onPress }) {
  return <ActionButton onPress={onPress} iconName="trash-can" style={styles.position} />;
}

const styles = StyleSheet.create({
  position: { left: "50%", marginLeft: -30, bottom: 30 },
});
