import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { FlatList, Text, View, Image, TouchableOpacity } from 'react-native';
import { SignOutButton } from '@/components/SignOutButton';
import { useBikeRides } from '../../hooks/useBikeRides';
import { useEffect } from 'react';
import PageLoader from "../../components/PageLoader";
import { styles } from "../../assets/styles/home.styles";
import { Ionicons } from "@expo/vector-icons";
import { BalanceCard } from '../../components/BalanceCard';
import { BikeRideItem } from '../../components/BikeRideItem';

export default function Page() {
  const { user } = useUser();
  const {  bikeRides, summary, isLoading, loadData, deleteBikeRide } = useBikeRides(user.id);
  
  console.log(bikeRides);

  useEffect(() => {
    loadData()
  }, [loadData]);

  const handleDelete = (id) => {
    Alert.alert("Logout", "Are you sure you want to delete this bike ride?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteBikeRide(id) },
        ]);
  }
  


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
              <TouchableOpacity style={styles.addButton} onPress={() => router.push("/create")}>
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
              <SignOutButton />
            </View>
        </View>

        
        <BalanceCard summary={summary} />

        <View style={styles.transactionsHeaderContainer}>
          <Text style={styles.sectionTitle}>Recent Bike Rides</Text>
        </View>


      </View>

      <FlatList
        style={styles.transactionsList}
        contentContainerStyle={styles.transactionsListContent}
        data={bikeRides}
        renderItem={({item}) => (
           <BikeRideItem item={item} onDelete={handleDelete} />
        )}

       />
    </View>
  )
}