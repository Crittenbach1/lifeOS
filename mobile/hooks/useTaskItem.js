// mobile/hooks/useTaskItem.js
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { API_URL } from "../constants/api";

/**
 * useTaskItem
 * - Handles loading, creating, and deleting taskItems
 * - Uses controller routes:
 *   GET    /api/taskItem/type/:taskTypeID
 *   GET    /api/taskItem/:id
 *   POST   /api/taskItem
 *   DELETE /api/taskItem/:id
 */
export const useTaskItem = (taskTypeID) => {
  const [taskItems, setTaskItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTaskItems = useCallback(async () => {
    if (!taskTypeID) return;
    const res = await fetch(`${API_URL}/taskItem/type/${taskTypeID}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch task items (HTTP ${res.status})`);
    }
    const data = await res.json();
    setTaskItems(Array.isArray(data) ? data : []);
  }, [taskTypeID]);

  const loadData = useCallback(async () => {
    if (!taskTypeID) return;
    setIsLoading(true);
    try {
      await fetchTaskItems();
    } catch (err) {
      console.error("Error loading task items:", err);
    } finally {
      setIsLoading(false);
    }
  }, [taskTypeID, fetchTaskItems]);

  useEffect(() => {
    if (taskTypeID) loadData();
  }, [taskTypeID, loadData]);

  const createTaskItem = useCallback(
    async (newItem) => {
      const res = await fetch(`${API_URL}/taskItem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) {
        let msg;
        try {
          msg = (await res.json()).message;
        } catch {
          msg = await res.text();
        }
        throw new Error(msg || "Failed to create task item");
      }
      await loadData();
      Alert.alert("Success", "Task item created successfully");
    },
    [loadData]
  );

  const deleteTaskItem = useCallback(
    async (taskItemId) => {
      const res = await fetch(`${API_URL}/taskItem/${taskItemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        let msg;
        try {
          msg = (await res.json()).message;
        } catch {
          msg = await res.text();
        }
        throw new Error(msg || "Failed to delete task item");
      }
      await loadData();
      Alert.alert("Success", "Task item deleted successfully");
    },
    [loadData]
  );

  return { taskItems, isLoading, loadData, createTaskItem, deleteTaskItem };
};
