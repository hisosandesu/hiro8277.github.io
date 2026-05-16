import { StyleSheet } from "react-native";
import { Trash2 } from "lucide-react-native";
import ActionButton from "./ActionButton";

export default function ClearButton({ onPress }) {
  return <ActionButton onPress={onPress} IconComponent={Trash2} style={styles.position} />;
}

const styles = StyleSheet.create({
  position: { left: "50%", marginLeft: -30, bottom: 90 },
});
