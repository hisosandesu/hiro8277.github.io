import { StyleSheet } from "react-native";
import { Camera } from "lucide-react-native";
import ActionButton from "./ActionButton";

export default function FloatingButton({ onPress }) {
  return <ActionButton onPress={onPress} IconComponent={Camera} style={styles.position} />;
}

const styles = StyleSheet.create({
  position: { right: 30, bottom: 90 },
});
