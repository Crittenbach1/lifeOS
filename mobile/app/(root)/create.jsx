import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useState } from "react";
import { styles } from "../../assets/styles/create.styles";
import { COLORS } from "../../constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../../constants/api";

const CATEGORIES = [
  { id: "income", name: "Income", icon: "cash" },
  { id: "bike", name: "Bike Ride", icon: "bicycle" },
  { id: "water", name: "Drink Water", icon: "cafe-outline" },
  { id: "workout", name: "Workout", icon: "barbell" },
];

const WORKOUT_OPTIONS = [
  "Lower Body - Leg Press",
  "Lower Body - Seated Leg Curl",
  "Lower Body - Leg Extension",
  "Lower Body - Glute Kickback",
  "Lower Body - Seated Calf Raise",
  "Upper Body - Crunch",
  "Upper Body - Chest Press",
  "Upper Body - Shoulder Press",
  "Upper Body - Lat Pulldown",
  "Upper Body - Seated Row",
  "Upper Body - Triceps Pushdown",
  "Upper Body - Bicep Curl",
];

const getAmountLabel = (category) => {
  switch (category) {
    case "Bike Ride":
      return "Seconds Biked";
    case "Drink Water":
      return "# Bottles";
    case "Workout":
      return "Select Exercise";
    case "Income":
      return "$";
    default:
      return "Amount";
  }
};

const CreateScreen = () => {
  const router = useRouter();
  const { user } = useUser();

  const [amount, setAmount] = useState("");
  const [selectedWorkout, setSelectedWorkout] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!selectedCategory) return Alert.alert("Error", "Please select a category");

    if (selectedCategory === "Workout") {
      if (!selectedWorkout)
        return Alert.alert("Error", "Please select a workout exercise");
    } else {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return Alert.alert("Error", "Please enter a valid number");
      }
    }

    setIsLoading(true);
    try {
      const createdAt = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const startTime = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      let endpoint = "";
      let body = {};

      if (selectedCategory === "Bike Ride") {
        endpoint = `${API_URL}/bikeRides`;
        body = {
          user_id: user.id,
          lengthInSeconds: Number(amount),
          start_time: startTime,
          created_at: createdAt, // remove if backend defaults created_at
        };
      } else if (selectedCategory === "Income") {
        endpoint = `${API_URL}/income`;
        body = {
          user_id: user.id,
          amount: Number(amount),
          minutes_worked: 0,
          created_at: createdAt, // remove if backend defaults created_at
        };
      } else if (selectedCategory === "Drink Water") {
        endpoint = `${API_URL}/drinkWater`;
        body = {
          user_id: user.id,
          amount: Number(amount),
          created_at: createdAt,
        };
      } else if (selectedCategory === "Workout") {
        // adjust endpoint/fields to match your backend when you add it
        endpoint = `${API_URL}/workout`;
        body = {
          user_id: user.id,
          exercise: selectedWorkout,
          created_at: createdAt,
        };
      } else {
        throw new Error("Unsupported category");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let msg;
        try {
          const j = await response.json();
          msg = j.message || j.error;
        } catch {
          msg = await response.text();
        }
        throw new Error(msg || `HTTP ${response.status}`);
      }

      Alert.alert("Success", "Entry saved!");
      router.back();
    } catch (error) {
      console.error("Create error:", error);
      Alert.alert("Error", error.message || "Failed to save");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Entry</Text>
        <TouchableOpacity
          style={[styles.saveButtonContainer, isLoading && styles.saveButtonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          <Text style={styles.saveButton}>{isLoading ? "Saving..." : "Save"}</Text>
          {!isLoading && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {!!selectedCategory &&
          (selectedCategory === "Workout" ? (
            <View style={styles.inputContainer}>
              <Ionicons
                name="barbell"
                size={22}
                color={COLORS.textLight}
                style={styles.inputIcon}
              />
              <TouchableOpacity
                style={[styles.input, { justifyContent: "center" }]}
                onPress={() =>
                  Alert.alert("Select Exercise", "", [
                    ...WORKOUT_OPTIONS.map((option) => ({
                      text: option,
                      onPress: () => setSelectedWorkout(option),
                    })),
                    { text: "Cancel", style: "cancel" },
                  ])
                }
              >
                <Text style={{ color: selectedWorkout ? COLORS.text : COLORS.textLight }}>
                  {selectedWorkout || "Select an exercise"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>{getAmountLabel(selectedCategory)}</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.textLight}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>
          ))}

        <Text style={styles.sectionTitle}>
          <Ionicons name="pricetag-outline" size={16} color={COLORS.text} /> Category
        </Text>

        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.name && styles.categoryButtonActive,
              ]}
              onPress={() => {
                setSelectedCategory(category.name);
                setAmount("");
                setSelectedWorkout("");
              }}
            >
              <Ionicons
                name={category.icon}
                size={20}
                color={selectedCategory === category.name ? COLORS.white : COLORS.text}
                style={styles.categoryIcon}
              />
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category.name && styles.categoryButtonTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
};

export default CreateScreen;
