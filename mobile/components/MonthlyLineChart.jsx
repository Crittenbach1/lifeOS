import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function MonthlyLineChart({ data }) {
  const chartData = {
    labels: data.map((item) => item.label),      // e.g., ['Mar', 'Apr', 'May', 'Jun']
    datasets: [
      {
        data: data.map((item) => item.minutes),   // e.g., [500, 700, 450, 820]
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Bike Time</Text>
      <LineChart
        data={chartData}
        width={screenWidth - 32}
        height={220}
        yAxisSuffix="m"
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
  propsForDots: {
    r: '5',
    strokeWidth: '2',
    stroke: '#007aff',
  },
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  chart: {
    borderRadius: 16,
  },
});
