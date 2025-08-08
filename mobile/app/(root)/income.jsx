import { ScrollView, View, RefreshControl } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useIncome } from "../../hooks/useIncome.js";
import PageLoader from "../../components/PageLoader";
import { styles } from "../../assets/styles/home.styles";
import IncomeProgressWheel from "../../components/IncomeProgressWheel";
import IncomeWeeklyProgressBar from '../../components/IncomeWeeklyProgressBar';
import IncomeMonthlyProgressBar from '../../components/IncomeMonthlyProgressBar';
import IncomeYearlyProgressBar from '../../components/IncomeYearlyProgressBar';
//import MonthlyLineChart from '../../components/MonthlyLineChart';
import { getLastFiveMonthsSummary } from "@/lib/getLastFiveMonthsSummary";

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { incomes, summary, isLoading, loadData } = useIncome(user.id);
  const chartData = getLastFiveMonthsSummary(incomes);
 
  console.log(summary);

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

    <IncomeProgressWheel summary={summary} />
    <IncomeWeeklyProgressBar summary={summary} />
    <IncomeMonthlyProgressBar summary={summary} />
    <IncomeYearlyProgressBar summary={summary} />
      
    </ScrollView>
  );
}
