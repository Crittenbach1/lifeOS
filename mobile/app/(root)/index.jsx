import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors"; // adjust path if needed

export default function HomePage() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to LifeOS</Text>
      <Text style={styles.subtext}>Your tasks, habits, and progress all in one place.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text || "#000",
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: COLORS.textLight || "#666",
    textAlign: "center",
  },
});
