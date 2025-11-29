import { StyleSheet, TouchableOpacity } from "react-native";
import Icon from "@react-native-vector-icons/fontawesome6";

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    bottom: 30,
    left: 30,
    width: 60,
    height: 60,
    backgroundColor: "#167476",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default function SaveButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Icon name="floppy-disk" size={25} color={"white"} solid />
    </TouchableOpacity>
  );
}
