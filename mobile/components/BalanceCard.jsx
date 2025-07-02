import { View, Text } from "react-native";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";



export const BalanceCard = ({ summary }) => {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceTitle}>Total Biked Minutes Today</Text>
      <Text style={styles.balanceAmount}>{summary.today}</Text>
      <Text style={styles.balanceTitle}>Total Biked Minutes This Week</Text>
      <Text style={styles.balanceAmount}>{summary.thisWeek}</Text>
      <Text style={styles.balanceTitle}>Total Biked Minutes This Month</Text>
      <Text style={styles.balanceAmount}>{summary.thisMonth}</Text>
      <Text style={styles.balanceTitle}>Total Biked Minutes This Year</Text>
      <Text style={styles.balanceAmount}>{summary.thisYear}</Text>
    </View>
  );
};
