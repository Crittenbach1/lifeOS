import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { API_URL } from "../constants/api";

//const API_URL = "http://localhost:5001/api";
//const API_URL = "https://lifeos-fak9.onrender.com/api";

export const useIncome = (userId) => {
  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState({
    incomeToday: 0,
    incomeThisWeek: 0,
    incomeThisMonth: 0,
    incomeThisYear: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchIncome = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/income/${userId}`);
      const data = await response.json();
      setIncomes(data);
    } catch (error) {
      console.error("Error fetching income:", error);
    }
  }, [userId]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/income/summary/${userId}`);
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error("Error fetching income summary:", error);
    }
  }, [userId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchIncome(), fetchSummary()]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchIncome, fetchSummary]);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [loadData, userId]);

  const deleteIncome = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_URL}/income/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete income");

      await loadData();
      Alert.alert("Success", "income deleted successfully");
    } catch (error) {
      console.error("Error deleting income:", error);
      Alert.alert("Error", error.message);
    }
  }, [loadData]);

  return { incomes, summary, isLoading, loadData, deleteIncome };
};
