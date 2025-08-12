import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { API_URL } from "../constants/api";

export const useDrinkWater = (userId) => {
  const [drinks, setDrinks] = useState([]);
  const [summary, setSummary] = useState({
    today: { amount: 0, count: 0 },
    thisWeek: { amount: 0, count: 0 },
    thisMonth: { amount: 0, count: 0 },
    thisYear: { amount: 0, count: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchDrinks = useCallback(async () => {
    const res = await fetch(`${API_URL}/drinkWater/${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch drinkWater (HTTP ${res.status})`);
    const data = await res.json();
    setDrinks(Array.isArray(data) ? data : []);
  }, [userId]);

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`${API_URL}/drinkWater/summary/${userId}`);
    if (!res.ok) throw new Error(`Failed to fetch drinkWater summary (HTTP ${res.status})`);
    const data = await res.json();

    setSummary({
      today: {
        amount: Number(data?.today?.amount ?? 0),
        count: Number(data?.today?.count ?? 0),
      },
      thisWeek: {
        amount: Number(data?.thisWeek?.amount ?? 0),
        count: Number(data?.thisWeek?.count ?? 0),
      },
      thisMonth: {
        amount: Number(data?.thisMonth?.amount ?? 0),
        count: Number(data?.thisMonth?.count ?? 0),
      },
      thisYear: {
        amount: Number(data?.thisYear?.amount ?? 0),
        count: Number(data?.thisYear?.count ?? 0),
      },
    });
  }, [userId]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await Promise.all([fetchDrinks(), fetchSummary()]);
    } catch (err) {
      console.error("Error loading drinkWater data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, fetchDrinks, fetchSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addDrinkWater = useCallback(
    async ({ user_id, amount, created_at }) => {
      const res = await fetch(`${API_URL}/drinkWater`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, amount, created_at }),
      });
      if (!res.ok) {
        let msg;
        try { msg = (await res.json()).message; } catch { msg = await res.text(); }
        throw new Error(msg || "Failed to create drinkWater entry");
      }
      await loadData();
      Alert.alert("Success", "Water logged");
    },
    [loadData]
  );

  const deleteDrinkWater = useCallback(
    async (id) => {
      const res = await fetch(`${API_URL}/drinkWater/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let msg;
        try { msg = (await res.json()).message; } catch { msg = await res.text(); }
        throw new Error(msg || "Failed to delete drinkWater entry");
      }
      await loadData();
      Alert.alert("Success", "Entry deleted");
    },
    [loadData]
  );

  return { drinks, summary, isLoading, loadData, addDrinkWater, deleteDrinkWater };
};
