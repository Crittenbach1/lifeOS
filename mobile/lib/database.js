import AsyncStorage from '@react-native-async-storage/async-storage';

const getTodayKey = () => {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  return `tasks-${today}`;
};

export const fetchTasksFromDB = async () => {
  const key = getTodayKey();
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

export const saveGeneratedTasks = async (tasks) => {
  const key = getTodayKey();
  await AsyncStorage.setItem(key, JSON.stringify(tasks));
};

export const saveTaskCompletion = async (taskId) => {
  const key = getTodayKey();
  const data = await fetchTasksFromDB();
  const updated = data.map(task =>
    task.id === taskId ? { ...task, completed: true } : task
  );
  await AsyncStorage.setItem(key, JSON.stringify(updated));
};
