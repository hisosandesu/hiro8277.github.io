import { StyleSheet, TouchableOpacity } from "react-native";
import Icon from "@react-native-vector-icons/fontawesome6";

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 30,
    bottom: 30,
    width: 60,
    height: 60,
    backgroundColor: "#167476",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
  },
});

export default function FloatingButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Icon name="square-plus" size={25} color={"white"} solid />
    </TouchableOpacity>
  );
}
