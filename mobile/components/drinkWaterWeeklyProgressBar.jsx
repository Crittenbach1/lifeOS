import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ProgressBar } from "react-native-paper";

// Convert liters (source of truth) to display unit
function convertFromLiters(liters, unit) {
  switch (unit) {
    case "ml": return liters * 1000;
    case "oz": return liters * 33.814;
    case "L":
    default:   return liters;
  }
}

function formatAmount(value, unit) {
  if (unit === "ml" || unit === "oz") return `${Math.round(value)} ${unit}`;
  return `${value.toFixed(1)} L`;
}

export default function DrinkWaterWeeklyProgressBar({
  summary,
  goalLiters = 21,  // weekly goal in liters
  unit = "L",       // "L" | "ml" | "oz" (display only; math stays in liters)
}) {
  // Accept either a number or an object { amount, count }
  const rawWeekly = summary?.thisWeek;
  const litersConsumedRaw =
    rawWeekly && typeof rawWeekly === "object"
      ? Number(rawWeekly.amount)
      : Number(rawWeekly);

  const litersConsumed = Number.isFinite(litersConsumedRaw)
    ? Math.max(0, litersConsumedRaw)
    : 0;

  const progress = Math.max(0, Math.min(litersConsumed / goalLiters, 1));

  const displayConsumed = convertFromLiters(litersConsumed, unit);
  const displayGoal = convertFromLiters(goalLiters, unit);

  return (
    <View style={styles.container} accessible accessibilityLabel="Weekly water progress">
      <Text style={styles.label}>Weekly Water Progress</Text>
      <ProgressBar
        progress={progress}
        color="#3498db"
        style={styles.bar}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: Math.round(progress * 100), min: 0, max: 100 }}
      />
      <Text style={styles.text}>
        {formatAmount(displayConsumed, unit)} / {formatAmount(displayGoal, unit)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 20, marginTop: 10, marginBottom: 30 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#333" },
  bar: { height: 12, borderRadius: 6, backgroundColor: "#dfe6e9" },
  text: { fontSize: 14, color: "#555", marginTop: 6 },
});
