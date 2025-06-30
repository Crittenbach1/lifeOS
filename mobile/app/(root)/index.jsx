import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SignOutButton } from '@/components/SignOutButton';
import { useBikeRides } from '../../hooks/useBikeRides';
import { useEffect } from 'react';
import PageLoader from "../../components/PageLoader";

export default function Page() {
  const { user } = useUser();
  const {  bikeRides, summary, isLoading, loadData, deleteBikeRide } = useBikeRides(user.id);

  useEffect(() => {
    loadData()
  }, [loadData]);

  if(isLoading) return <PageLoader />

  return (
    <View>
      <SignedIn>
        <Text>Hello {user?.emailAddresses[0].emailAddress}</Text>
        <Text>Today's total min: {summary.today}</Text>
        <Text>Weekly total min: {summary.thisWeek}</Text>
        <Text>Monthly total min: {summary.thisMonth}</Text>
        <Text>Yearly total min: {summary.thisYear}</Text>

        <SignOutButton />
      </SignedIn>
      <SignedOut>
        <Link href="/(auth)/sign-in">
          <Text>Sign in</Text>
        </Link>
        <Link href="/(auth)/sign-up">
          <Text>Sign up</Text>
        </Link>
      </SignedOut>
    </View>
  )
}