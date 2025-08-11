import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ProgressBar } from "react-native-paper";

export default function MonthlyWaterProgressBar({
  summary,
  goal = 64 * 30, // default: 64 oz/day × ~30 days
  unit = "oz",
}) {
  const consumed = Number(summary?.thisMonth ?? 0);
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const progress = Math.max(0, Math.min(safeConsumed / goal, 1));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Monthly Water Progress</Text>
      <ProgressBar progress={progress} color="#3498db" style={styles.bar} />
      <Text style={styles.text}>
        {safeConsumed.toFixed(0)} {unit} / {goal} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  bar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#dfe6e9",
  },
  text: {
    fontSize: 14,
    color: "#555",
    marginTop: 6,
  },
});
