import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';

export default function WeeklyIncomeProgressBar({ summary }) {

  const goal = 231;
  const earned = summary?.thisWeek?.income ?? 0; // Make sure thisWeek is passed correctly
  const progress = Math.min(earned / goal, 1); // cap at 100%

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Weekly Income Progress</Text>
      <ProgressBar progress={progress} color="#27ae60" style={styles.bar} />
      <Text style={styles.text}>${earned.toFixed(2)} / ${goal}</Text>
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
