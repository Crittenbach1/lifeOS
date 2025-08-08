import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';

export default function BikeProgressWheel({ summary }) {
  const goalInMinutes = 30;
  const minutesBiked = summary?.today ?? 0;
  const fill = (minutesBiked / goalInMinutes) * 100;

  // Convert minutes to seconds for formatted display
  const totalSeconds = Math.round(minutesBiked * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <View style={styles.container}>
      <AnimatedCircularProgress
        size={200}
        width={15}
        fill={fill}
        tintColor="#00e0ff"
        backgroundColor="#3d5875"
      >
        {() => (
          <Text style={styles.text}>
            {minutes}:{String(seconds).padStart(2, '0')} / 30:00
          </Text>
        )}
      </AnimatedCircularProgress>
      <Text style={styles.label}>Today's Ride</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  text: {
    fontSize: 22,
    color: '#333',
    fontWeight: 'bold',
  },
  label: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
