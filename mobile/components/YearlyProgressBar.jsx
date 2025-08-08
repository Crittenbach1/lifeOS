import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';

export default function YearlyProgressBar({ summary }) {
  const goalInMinutes = 10950; // Example: 30 minutes/day * 365 days
  const minutesThisYear = summary?.thisYear ?? 0;
  const progress = Math.min(minutesThisYear / goalInMinutes, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Yearly Progress</Text>
      <ProgressBar progress={progress} color="#6c5ce7" style={styles.bar} />
      <Text style={styles.text}>
        {minutesThisYear} / {goalInMinutes} minutes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  bar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#dfe6e9',
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginTop: 6,
  },
});
