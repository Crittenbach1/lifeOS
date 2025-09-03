// app/(root)/_layout.tsx
import React, { useState } from "react";
import { Redirect, Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, Text } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import SafeScreen from "@/components/SafeScreen";
import TaskTypePicker from "@/components/TaskTypePicker";
import AppTopBar from "@/components/AppTopBar";

export default function Layout() {
  const { isSignedIn, isLoaded } = useUser();
  const [showPicker, setShowPicker] = useState(false);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <SafeScreen>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: "#007aff",
          tabBarInactiveTintColor: "gray",
          tabBarIcon: ({ color, size }) => {
            let icon: any = "home";
            if (route.name === "index") icon = "home";
            else if (route.name === "create") icon = "add-circle";
            else if (route.name === "tasks-button") icon = "list";
            else if (route.name === "task-type/health") icon = "heart";
            return <Ionicons name={icon} size={size} color={color} />;
          },
        })}
      >
        {/* Home with custom top header */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            headerShown: true,
            header: () => <AppTopBar />,
          }}
        />

        {/* Health tab (heart icon + "Health" label) */}
        <Tabs.Screen
          name="task-type/health"
          options={{
            title: "Health",
          }}
        />

        {/* Hidden dynamic route */}
        <Tabs.Screen name="task-type/[id]" options={{ href: null }} />

        {/* Custom Tasks button (icon + label stacked) */}
        <Tabs.Screen
          name="tasks-button"
          options={{
            title: "Tasks",
            tabBarButton: (props) => {
              const selected = props.accessibilityState?.selected;
              const color = selected ? "#007aff" : "gray";

              return (
                <TouchableOpacity
                  accessibilityLabel={props.accessibilityLabel}
                  accessibilityRole={props.accessibilityRole}
                  accessibilityState={props.accessibilityState}
                  testID={props.testID}
                  activeOpacity={0.7}
                  onPress={() => setShowPicker(true)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <Ionicons name="list" size={24} color={color} />
                  <Text style={{ fontSize: 12, color, marginTop: 2 }}>Tasks</Text>
                </TouchableOpacity>
              );
            },
          }}
        />

        <Tabs.Screen name="create" options={{ title: "Create" }} />
      </Tabs>

      <TaskTypePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={(t) => {
          setShowPicker(false);
          router.push(
            `/task-type/${encodeURIComponent(t.id)}?name=${encodeURIComponent(t.name)}` as any
          );
        }}
      />
    </SafeScreen>
  );
}
