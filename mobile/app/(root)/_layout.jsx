import { useUser } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SafeScreen from "@/components/SafeScreen";

export default function Layout() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <SafeScreen>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size, focused }) => {
            let iconName = "home";

            if (route.name === "index") iconName = "home";
            else if (route.name === "create") iconName = "add-circle";
            else if (route.name === "bikeRides") iconName = "bicycle";
            else if (route.name === "income") iconName = "cash";
            else if (route.name === "drinkWater") iconName = focused ? "cafe" : "cafe-outline"; // cup icon

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: "#007aff",
          tabBarInactiveTintColor: "gray",
          headerShown: false,
        })}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="create" options={{ title: "Create" }} />
        <Tabs.Screen name="bikeRides" options={{ title: "Bike Rides" }} />
        <Tabs.Screen name="income" options={{ title: "Income" }} />
        <Tabs.Screen name="drinkWater" options={{ title: "Water" }} />
      </Tabs>
    </SafeScreen>
  );
}
