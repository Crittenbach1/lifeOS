import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { API_URL } from "../constants/api";

//const API_URL = "http://localhost:5001/api";
//const API_URL = "https://lifeos-fak9.onrender.com/api";

export const useBikeRides = (userId) => {
  const [bikeRides, setBikeRides] = useState([]);
  const [summary, setSummary] = useState({
    minutesToday: 0,
    minutesThisWeek: 0,
    minutesThisMonth: 0,
    minutesThisYear: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchBikeRides = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/bikeRides/${userId}`);
      const data = await response.json();
      setBikeRides(data);
    } catch (error) {
      console.error("Error fetching bike rides:", error);
    }
  }, [userId]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/bikeRides/summary/${userId}`);
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  }, [userId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchBikeRides(), fetchSummary()]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBikeRides, fetchSummary]);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [loadData, userId]);

  const deleteBikeRide = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_URL}/bikeRides/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete bike ride");

      await loadData();
      Alert.alert("Success", "Bike ride deleted successfully");
    } catch (error) {
      console.error("Error deleting bike ride:", error);
      Alert.alert("Error", error.message);
    }
  }, [loadData]);

  return { bikeRides, summary, isLoading, loadData, deleteBikeRide };
};