import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';

export default function WeeklyProgressBar({ summary }) {
  const goalInMinutes = 210; // Example weekly goal (e.g. 30 min x 7 days)
  const minutesThisWeek = summary?.thisWeek ?? 0;
  const progress = Math.min(minutesThisWeek / goalInMinutes, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Weekly Progress</Text>
      <ProgressBar progress={progress} color="#0984e3" style={styles.bar} />
      <Text style={styles.text}>
        {minutesThisWeek} / {goalInMinutes} minutes
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
