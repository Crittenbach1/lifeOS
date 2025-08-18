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
import { styles } from "../../assets/styles/home.styles";


export default function Page() {

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>

      </View>
    </ScrollView>
  );
}