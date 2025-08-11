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

import { getLastFiveMonthsSummary } from "@/lib/getLastFiveMonthsSummary";

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { drinkWater, summary, isLoading, loadData } = useDrinkWater(user.id);

  // If getLastFiveMonthsSummary currently sums minutes, switch to amount for water.
  const chartData = getLastFiveMonthsSummary(drinkWater);

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
  const DAILY_GOAL_OZ = 64;

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
        goal={DAILY_GOAL_OZ}
        unit="oz"
        width={180}
        height={220}
      />

      <WeeklyWaterProgressBar summary={summary} goal={64 * 7} unit="oz" />
      <MonthlyWaterProgressBar summary={summary} goal={64 * 30} unit="oz" />
      <YearlyWaterProgressBar summary={summary} goal={64 * 365} unit="oz" />

      {/* If you want the line chart here, import and render it:
         <DrinkWaterMonthlyLineChart data={chartData} unit="oz" />
      */}
    </ScrollView>
  );
}
