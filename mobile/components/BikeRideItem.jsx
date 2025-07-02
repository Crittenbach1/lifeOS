import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";
import { formatDate } from "../lib/utils";

export const BikeRideItem = ({ item, onDelete }) => {
  const totalSeconds = Math.floor(item.lengthinseconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <View style={styles.transactionCard}>
      <TouchableOpacity style={styles.transactionContent}>
        <View style={styles.categoryIconContainer}>
          <Ionicons name="bicycle" size={22} color="blue" />
        </View>
        <View style={styles.transactionLeft}>
          {/* Optional: Add ride title or notes here */}
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: "blue" }]}>
            {minutes > 0 ? `${minutes} min ` : ""}
            {`${seconds} sec`}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
        <Ionicons name="trash-outline" size={20} color={COLORS.expense} />
      </TouchableOpacity>
    </View>
  );
};
