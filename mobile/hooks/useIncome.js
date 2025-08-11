// mobile/hooks/useIncome.js
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { API_URL } from "../constants/api";

export const useIncome = (userId) => {
  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState({
    today: { income: 0, minutesWorked: 0 },
    thisWeek: { income: 0, minutesWorked: 0 },
    thisMonth: { income: 0, minutesWorked: 0 },
    thisYear: { income: 0, minutesWorked: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchIncome = useCallback(async () => {
    const res = await fetch(`${API_URL}/income/${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch incomes (HTTP ${res.status})`);
    const data = await res.json();
    setIncomes(Array.isArray(data) ? data : []);
  }, [userId]);

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`${API_URL}/income/summary/${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch summary (HTTP ${res.status})`);
    const data = await res.json();

    setSummary({
      today: {
        income: Number(data?.today?.income ?? 0),
        minutesWorked: Number(data?.today?.minutesWorked ?? 0),
      },
      thisWeek: {
        income: Number(data?.thisWeek?.income ?? 0),
        minutesWorked: Number(data?.thisWeek?.minutesWorked ?? 0),
      },
      thisMonth: {
        income: Number(data?.thisMonth?.income ?? 0),
        minutesWorked: Number(data?.thisMonth?.minutesWorked ?? 0),
      },
      thisYear: {
        income: Number(data?.thisYear?.income ?? 0),
        minutesWorked: Number(data?.thisYear?.minutesWorked ?? 0),
      },
    });
  }, [userId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchIncome(), fetchSummary()]);
    } catch (err) {
      console.error("Error loading income data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchIncome, fetchSummary]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId, loadData]);

  const deleteIncome = useCallback(
    async (id) => {
      const res = await fetch(`${API_URL}/income/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let msg;
        try { msg = (await res.json()).message; } catch { msg = await res.text(); }
        throw new Error(msg || "Failed to delete income");
      }
      await loadData();
      Alert.alert("Success", "income deleted successfully");
    },
    [loadData]
  );

  return { incomes, summary, isLoading, loadData, deleteIncome };
};
