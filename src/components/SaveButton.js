import { StyleSheet } from "react-native";
import { Save } from "lucide-react-native";
import ActionButton from "./ActionButton";

export default function SaveButton({ onPress }) {
  return <ActionButton onPress={onPress} IconComponent={Save} style={styles.position} />;
}

const styles = StyleSheet.create({
  position: { left: 30, bottom: 90 },
});
