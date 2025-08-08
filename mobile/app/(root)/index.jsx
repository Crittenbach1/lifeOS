import { SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  Button,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SignOutButton } from "@/components/SignOutButton";
import PageLoader from "../../components/PageLoader";
import TaskCard from "../../components/TaskCard";
import { styles } from "../../assets/styles/home.styles";
import { useTodayTasks } from "../../hooks/useTodayTasks";

export default function Page() {
  const {
    currentTask,
    completeTask,
    moveWaterTaskToEnd,
    tasks,
    isLoading,
    showIncomeModal,
    setShowIncomeModal,
    incomeInput,
    setIncomeInput,
  } = useTodayTasks();

  const { user } = useUser();
  const router = useRouter();

  const completedTasks = tasks.filter((t) => t.completed);

  if (isLoading) return <PageLoader />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* LEFT */}
          <View style={styles.headerLeft}>
            <Image
              source={require("../../assets/images/lifeOSicon.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>Welcome,</Text>
              <Text style={styles.usernameText}>
                {user?.emailAddresses[0]?.emailAddress.split("@")[0]}
              </Text>
            </View>
          </View>

          {/* RIGHT */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/create")}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
            <SignOutButton />
          </View>
        </View>

        {/* CURRENT TASK */}
        {currentTask ? (
          <View>
            <TaskCard task={currentTask} onComplete={completeTask} />

            {/* 🔁 Skip for now button ONLY for "Drink water bottle" */}
            {currentTask.title === "Drink water bottle" && (
              <TouchableOpacity
                onPress={() => moveWaterTaskToEnd(currentTask.id)}
                style={{
                  marginTop: 10,
                  padding: 10,
                  backgroundColor: "#ccc",
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#333" }}>Skip for now (move to end)</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={{ fontSize: 16, marginVertical: 20 }}>
            🎉 All available tasks completed for now!
          </Text>
        )}

        {/* 💰 INCOME INPUT MODAL */}
        {showIncomeModal && (
          <View
            style={{
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 10,
              marginVertical: 20,
              borderColor: "#ccc",
              borderWidth: 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>
              Enter Instacart Income
            </Text>

            <TextInput
              placeholder="Amount earned ($)"
              keyboardType="numeric"
              value={incomeInput.amount}
              onChangeText={(text) =>
                setIncomeInput({ ...incomeInput, amount: text })
              }
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                padding: 10,
                borderRadius: 6,
                marginBottom: 10,
              }}
            />

            <TextInput
              placeholder="Hours worked"
              keyboardType="numeric"
              value={incomeInput.hours}
              onChangeText={(text) =>
                setIncomeInput({ ...incomeInput, hours: text })
              }
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                padding: 10,
                borderRadius: 6,
                marginBottom: 10,
              }}
            />

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Button
                title="Cancel"
                color="#888"
                onPress={() => {
                  setShowIncomeModal(false);
                  setIncomeInput({ amount: "", hours: "" });
                }}
              />
              <Button
                title="Submit"
                onPress={() => completeTask("loop-instacart")}
              />
            </View>
          </View>
        )}

        {/* COMPLETED TASKS */}
        {completedTasks.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <Text
              style={{
                fontWeight: "bold",
                fontSize: 18,
                marginBottom: 10,
              }}
            >
              ✅ Completed Tasks Today
            </Text>

            {completedTasks.map((task) => (
              <Text
                key={`${task.id}-${task.completedAt || "incomplete"}`}
                style={{ fontSize: 14, marginBottom: 6 }}
              >
                • {task.title} at{" "}
                {task.completedAt
                  ? new Date(task.completedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "unknown time"}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
