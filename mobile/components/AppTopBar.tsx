import React from "react";
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

export default function AppTopBar() {
  const { user } = useUser();
  const { signOut } = useAuth();

  const name =
    user?.firstName?.trim() ||
    user?.username?.trim() ||
    (user?.primaryEmailAddress?.emailAddress ?? "").split("@")[0] ||
    "there";

  const SignOutBtn = (
    <TouchableOpacity
      onPress={() => signOut()}
      activeOpacity={0.8}
      style={styles.signOutButton}
    >
      <Ionicons name="log-out-outline" size={16} color="#111827" />
      <Text style={styles.signOutText}>Sign out</Text>
    </TouchableOpacity>
  );

  const HeaderShell = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaView
      edges={["top"]}
      style={Platform.select({
        ios: styles.safeArea,
        android: styles.safeArea,
        default: styles.safeArea,
      })}
    >
      <View style={styles.header}>{children}</View>
    </SafeAreaView>
  );

  return (
    <HeaderShell>
      <View style={styles.bar}>
        {/* Left: icon + welcome */}
        <View style={styles.left}>
          <Image
            source={require("../assets/images/lifeOSicon.png")}
            style={styles.icon}
            contentFit="contain"
          />
          <Text numberOfLines={1} style={styles.welcome}>
            Welcome, <Text style={styles.welcomeBold}>{name}</Text>
          </Text>
        </View>

        {/* Right: Sign out */}
        <View style={styles.right}>{SignOutBtn}</View>
      </View>
    </HeaderShell>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#880000", // 🔴 deep red background
  },
  header: {
    backgroundColor: "#880000", // ensure header itself is red
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#660000",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  icon: { width: 22, height: 22, marginRight: 8 },
  welcome: { fontSize: 16, color: "#fff" }, // white text on red
  welcomeBold: { fontWeight: "800", color: "#fff" },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  signOutButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  signOutText: { color: "#111827", fontWeight: "700" },
});
