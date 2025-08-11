import { ScrollView, View, RefreshControl } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useBikeRides } from "../../hooks/useBikeRides.js";
import PageLoader from "../../components/PageLoader";
import { styles } from "../../assets/styles/home.styles";
import BikeProgressWheel from "../../components/BikeProgressWheel";
import WeeklyProgressBar from '../../components/WeeklyProgressBar';
import MonthlyProgressBar from '../../components/MonthlyProgressBar';
import YearlyProgressBar from '../../components/YearlyProgressBar';
import MonthlyLineChart from '../../components/MonthlyLineChart';
import { getLastFiveMonthsSummary } from "@/lib/getLastFiveMonthsSummary";

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { bikeRides, summary, isLoading, loadData } = useBikeRides(user.id);
  const chartData = getLastFiveMonthsSummary(bikeRides);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && !refreshing) return <PageLoader />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <BikeProgressWheel summary={summary} />
      <WeeklyProgressBar summary={summary} />
      <MonthlyProgressBar summary={summary} />
      <YearlyProgressBar summary={summary} />
      <MonthlyLineChart data={chartData} />
    </ScrollView>
  );
}