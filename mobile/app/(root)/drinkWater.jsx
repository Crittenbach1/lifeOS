import { ScrollView, RefreshControl } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { useDrinkWater } from "../../hooks/useDrinkWater.js";
import PageLoader from "../../components/PageLoader";
import { styles } from "../../assets/styles/home.styles";

import WaterProgressCup from "../../components/WaterProgressCup";
import DrinkWaterWeeklyProgressBar from "../../components/DrinkWaterWeeklyProgressBar";
import DrinkWaterMonthlyProgressBar from "../../components/DrinkWaterMonthlyProgressBar";
import DrinkWaterYearlyProgressBar from "../../components/DrinkWaterYearlyProgressBar";

export default function Page() {
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);

  const { drinks, summary, isLoading, loadData } = useDrinkWater(user?.id);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id, loadData]);

  if ((isLoading && !refreshing) || !user) return <PageLoader />;

  console.log(summary);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <WaterProgressCup summary={summary} />
      <DrinkWaterWeeklyProgressBar summary={summary} />
      <DrinkWaterMonthlyProgressBar summary={summary} />
      <DrinkWaterYearlyProgressBar summary={summary} />
    </ScrollView>
  );
}

