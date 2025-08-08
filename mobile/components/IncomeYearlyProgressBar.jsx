import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';

export default function YearlyIncomeProgressBar({ summary }) {
  const goal = 12000;
  const earned = summary?.thisYear?.income ?? 0;
  const progress = Math.min(earned / goal, 1); // cap at 100%

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Yearly Income Progress</Text>
      <ProgressBar progress={progress} color="#6c5ce7" style={styles.bar} />
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