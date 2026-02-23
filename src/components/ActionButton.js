import { StyleSheet, TouchableOpacity } from "react-native";
import Icon from "@react-native-vector-icons/fontawesome6";
import { COLORS } from "../constants/colors";

export default function ActionButton({ onPress, iconName, style }) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      <Icon name={iconName} size={25} color={COLORS.white} solid />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    width: 60,
    height: 60,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
