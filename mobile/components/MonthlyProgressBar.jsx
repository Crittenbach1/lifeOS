import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';


export default function MonthlyProgressBar({ summary }) {
  const goalInMinutes = 930; // 
  const minutesThisMonth = summary?.thisMonth ?? 0;
  const progress = Math.min(minutesThisMonth / goalInMinutes, 1); // max 1

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Monthly Progress</Text>
      <ProgressBar progress={progress} color="#00b894" style={styles.bar} />
      <Text style={styles.text}>
        {minutesThisMonth} / {goalInMinutes} minutes
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
