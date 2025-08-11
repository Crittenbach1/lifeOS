import { ScrollView, RefreshControl } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useDrinkWater } from "../../hooks/useDrinkWater.js";
import PageLoader from "../../components/PageLoader";
import { styles } from "../../assets/styles/home.styles";

import WaterProgressCup from "../../components/WaterProgressCup.jsx";
// default exports from your files, aliased to PascalCase for JSX:
import WeeklyWaterProgressBar from "../../components/drinkWaterWeeklyProgressBar.jsx";
import MonthlyWaterProgressBar from "../../components/drinkWaterMonthlyProgressBar.jsx";
import YearlyWaterProgressBar from "../../components/drinkWaterYearlyProgressBar.jsx";


export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { drinkWater, summary, isLoading, loadData } = useDrinkWater(user.id);


  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && !refreshing) return <PageLoader />;

  // pull user goal from settings if you have it; hardcode for now
  const DAILY_GOAL_LITERS = 3;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <WaterProgressCup
        value={Number(summary?.today ?? 0)}
        goal={DAILY_GOAL_LITERS}
        unit="liters"
        width={180}
        height={220}
      />

   
  
    </ScrollView>
  );
}
