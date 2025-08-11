import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { API_URL } from "../constants/api";

// Helper: parse JSON only if response is JSON; otherwise show first part of the text
const safeJson = async (res) => {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`[${res.status}] Non-JSON response: ${text.slice(0, 200)}...`);
  }
  return res.json();
};

export const useDrinkWater = (userId) => {
  const [drinkWater, setDrinkWater] = useState([]);
  const [summary, setSummary] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    thisYear: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchDrinkWater = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/drinkWater/${userId}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`[${res.status}] ${txt.slice(0, 200)}...`);
      }
      const data = await safeJson(res);
      setDrinkWater(data);
    } catch (error) {
      console.error("Error fetching drinkWater entries:", error);
    }
  }, [userId]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/drinkWater/summary/${userId}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`[${res.status}] ${txt.slice(0, 200)}...`);
      }
      const data = await safeJson(res);
      setSummary(data);
    } catch (error) {
      console.error("Error fetching drinkWater summary:", error);
    }
  }, [userId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchDrinkWater(), fetchSummary()]);
    } catch (error) {
      console.error("Error loading drinkWater data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDrinkWater, fetchSummary]);

  useEffect(() => {
    if (userId) loadData();
  }, [loadData, userId]);

  const addDrinkWater = useCallback(
    async (amount) => {
      try {
        const res = await fetch(`${API_URL}/drinkWater`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, amount }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`[${res.status}] ${txt.slice(0, 200)}...`);
        }
        await loadData();
        Alert.alert("Success", "Water entry added successfully");
      } catch (error) {
        console.error("Error adding drinkWater entry:", error);
        Alert.alert("Error", error.message);
      }
    },
    [userId, loadData]
  );

  const deleteDrinkWater = useCallback(
    async (id) => {
      try {
        const res = await fetch(`${API_URL}/drinkWater/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`[${res.status}] ${txt.slice(0, 200)}...`);
        }
        await loadData();
        Alert.alert("Success", "Water entry deleted successfully");
      } catch (error) {
        console.error("Error deleting drinkWater entry:", error);
        Alert.alert("Error", error.message);
      }
    },
    [loadData]
  );

  return { drinkWater, summary, isLoading, loadData, addDrinkWater, deleteDrinkWater };
};
