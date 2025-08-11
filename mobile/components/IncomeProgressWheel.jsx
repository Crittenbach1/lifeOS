import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';

export default function IncomeProgressWheel({ summary }) {
  const dailyGoal = 33;
  const income = summary?.today?.income ?? 0;
  const fill = (income / dailyGoal) * 100;


  return (
    <View style={styles.container}>
      <AnimatedCircularProgress
        size={200}
        width={15}
        fill={fill}
        tintColor="#27ae60"
        backgroundColor="#dfe6e9"
      >
        {() => (
          <Text style={styles.text}>
            ${income.toFixed(2)} / ${dailyGoal.toFixed(2)}
          </Text>
        )}
      </AnimatedCircularProgress>
      <Text style={styles.label}>Today's Income</Text>
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
    color: '#2d3436',
    fontWeight: 'bold',
  },
  label: {
    marginTop: 12,
    fontSize: 16,
    color: '#636e72',
  },
});
