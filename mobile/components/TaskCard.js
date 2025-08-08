import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function TaskCard({ task, onComplete }) {
  if (!task) {
    return (
      <View style={styles.card}>
        <Text style={styles.text}>All tasks completed for now 🎉</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.text}>{task.title}</Text>

  {task.dueTime && (
  <Text style={styles.subtext}>
    Due: {new Date(task.dueTime).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}
  </Text>
  )}


      <Button title="Complete" onPress={() => onComplete(task.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 20,
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    elevation: 4,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  loopLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 10,
  },
});
