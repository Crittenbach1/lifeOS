import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SignOutButton } from '@/components/SignOutButton';
import { useBikeRides } from '../../hooks/useBikeRides';
import { useEffect } from 'react';
import PageLoader from "../../components/PageLoader";
import { styles } from "../assets/styles/home.styles";

export default function Page() {
  const { user } = useUser();
  const {  bikeRides, summary, isLoading, loadData, deleteBikeRide } = useBikeRides(user.id);

  useEffect(() => {
    loadData()
  }, [loadData]);

  if(isLoading) return <PageLoader />

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* LEFT */}
          <View style={styles.headerLeft}>
            <Image
              source={require("../../assets/images/lifeOSicon.png")}
            />

          </View>
          {/* RIGHT */}
          <View>

          </View>
        </View>
      </View>
    </View>
  )
}