import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { COLORS } from "../constants/colors";

/**
 * Gemini プレミアムスキャン時に表示するプライバシー保護バッジ。
 * Google Gemini API 有料プランではスキャンデータが学習に利用されないことを示す。
 */
export default function PrivacyBadge() {
  return (
    <View style={styles.badge}>
      <ShieldCheck color={COLORS.primary} size={11} />
      <Text style={styles.text}>学習利用なし</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 3,
    marginBottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "rgba(22, 116, 118, 0.06)",
  },
  text: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: "600",
  },
});
