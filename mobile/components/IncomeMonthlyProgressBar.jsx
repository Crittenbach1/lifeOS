import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';

export default function IncomeMonthlyProgressBar({ summary }) {
  const goal = 1000;
  const earned = summary?.thisMonth?.income ?? 0;
  const progress = Math.min(earned / goal, 1); // cap at 100%

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Monthly Income Progress</Text>
      <ProgressBar progress={progress} color="#0984e3" style={styles.bar} />
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
