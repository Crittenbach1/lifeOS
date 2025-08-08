import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logBikeRide, logIncome } from "../lib/utils";
import { useUser } from "@clerk/clerk-expo";

const STORAGE_KEY = "bike-tasks-today";
const LAST_LOOP_KEY = "last-loop-task";
const LAST_GYM_KEY = "last-gym-activity";

const loopTasks = [
  { id: "loop-instacart", title: "Instacart $100" },
  { id: "loop-gym", title: "Go to the gym" },
  { id: "loop-code", title: "Work on coding project" },
  { id: "loop-read", title: "Read a book" },
];

const gymActivities = [
  "Lower Body - Leg Press",
  "Lower Body - Seated Leg Curl",
  "Lower Body - Leg Extension",
  "Lower Body - Glute Kickback",
  "Lower Body - Seated Calf Raise",
  "Upper Body - Crunch",
  "Upper Body - Chest Press",
  "Upper Body - Shoulder Press",
  "Upper Body - Lat Pulldown",
  "Upper Body - Seated Row",
  "Upper Body - Triceps Pushdown",
  "Upper Body - Bicep Curl",
  "swim",
  "basketball",
];

const generateAllTasksForToday = () => {
  const today = new Date();
  const dateString = today.toISOString().split("T")[0];
  const allTasks = [];

  for (let hour = 6; hour <= 22; hour++) {
    const dueTime = new Date(today);
    dueTime.setHours(hour, 0, 0, 0);
    allTasks.push({
      id: `bike-${hour}`,
      title: "Ride bike 1 minute",
      dueTime: dueTime.toISOString(),
      completed: false,
      date: dateString,
    });
  }

  const waterHours = [6, 9, 12, 15, 18, 22];
  for (let hour of waterHours) {
    const dueTime = new Date(today);
    dueTime.setHours(hour, 0, 0, 0);
    allTasks.push({
      id: `water-${hour}`,
      title: "Drink water bottle",
      dueTime: dueTime.toISOString(),
      completed: false,
      date: dateString,
    });
  }

  return allTasks;
};

const getTasksUpToNow = (allTasks) => {
  const now = new Date();
  return allTasks.filter((task) => new Date(task.dueTime) <= now);
};

export const useTodayTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loopTask, setLoopTask] = useState(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeInput, setIncomeInput] = useState({ amount: "", hours: "" });

  const { user } = useUser();

  const moveWaterTaskToEnd = async (taskId) => {
    const todayString = new Date().toISOString().split("T")[0];
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    let currentTasks = stored ? JSON.parse(stored) : [];

    const taskToMove = currentTasks.find((t) => t.id === taskId);
    if (!taskToMove) return;

    // Remove it and append to end
    const updatedTasks = currentTasks.filter((t) => t.id !== taskId);
    updatedTasks.push(taskToMove);

    setTasks(updatedTasks);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
  };

  const loadAndUpdateTasks = async () => {
    setIsLoading(true);
    try {
      const todayString = new Date().toISOString().split("T")[0];
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      let storedTasks = data ? JSON.parse(data) : [];

      const allTasks = generateAllTasksForToday();
      const availableTasks = getTasksUpToNow(allTasks);

      if (!storedTasks.length || storedTasks[0]?.date !== todayString) {
        storedTasks = [];
      }

      const newTasks = availableTasks.filter(
        (task) => !storedTasks.some((t) => t.id === task.id)
      );

      const updatedTasks = [...storedTasks, ...newTasks];
      setTasks(updatedTasks);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
    } catch (err) {
      console.error("❌ Failed to load or update tasks:", err);
    }
    setIsLoading(false);
  };

  const completeTask = async (taskId) => {
    const todayString = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    if (taskId.startsWith("loop-")) {
      await AsyncStorage.setItem(LAST_LOOP_KEY, taskId);

      if (taskId === "loop-gym" && loopTask?.meta?.gymActivity) {
        await AsyncStorage.setItem(LAST_GYM_KEY, loopTask.meta.gymActivity);
      }

      if (
        taskId === "loop-instacart" &&
        incomeInput.amount &&
        incomeInput.hours &&
        user?.id
      ) {
        try {
          const amount = parseFloat(incomeInput.amount);
          const hours = parseFloat(incomeInput.hours);
          const minutesWorked = Math.round(hours * 60);

          await logIncome({
            userId: user.id,
            amount,
            minutesWorked,
          });
        } catch (err) {
          console.error("❌ Failed to log income:", err.message);
        } finally {
          setShowIncomeModal(false);
          setIncomeInput({ amount: "", hours: "" });
        }
      }

      const newCompletedTask = {
        id: loopTask.id,
        title: loopTask.title,
        completed: true,
        completedAt: now,
        date: todayString,
      };

      const updatedTasks = [...tasks, newCompletedTask];
      setTasks(updatedTasks);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));

      setLoopTask(null);
      return;
    }

    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: true, completedAt: now } : t
    );
    setTasks(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    const completedTask = tasks.find((t) => t.id === taskId);
    if (completedTask?.id?.startsWith("bike-") && user?.id) {
      try {
        await logBikeRide({ userId: user.id, seconds: 60 });
      } catch (err) {
        console.error("❌ Failed to log bike ride:", err.message);
      }
    }
  };

  const checkForLoopTask = async () => {
    const allCompleted = tasks.length > 0 && tasks.every((t) => t.completed);
    if (!allCompleted) {
      setLoopTask(null);
      return;
    }

    const lastId = await AsyncStorage.getItem(LAST_LOOP_KEY);
    const lastIndex = loopTasks.findIndex((t) => t.id === lastId);
    const nextIndex = (lastIndex + 1) % loopTasks.length;
    const nextLoop = loopTasks[nextIndex];

    if (nextLoop.id === "loop-gym") {
      const lastGym = await AsyncStorage.getItem(LAST_GYM_KEY);
      const lastGymIndex = gymActivities.findIndex((g) => g === lastGym);
      const nextGymIndex = (lastGymIndex + 1) % gymActivities.length;
      const nextGymTitle = gymActivities[nextGymIndex];

      setLoopTask({
        ...nextLoop,
        title: `Go to gym: ${nextGymTitle}`,
        meta: {
          gymActivity: nextGymTitle,
        },
      });
    } else {
      setLoopTask(nextLoop);
      if (nextLoop.id === "loop-instacart") {
        setShowIncomeModal(true);
      }
    }
  };

  useEffect(() => {
    loadAndUpdateTasks();
    const interval = setInterval(() => {
      loadAndUpdateTasks();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkForLoopTask();
  }, [tasks]);

  const currentTask = tasks.find((t) => !t.completed) || loopTask;

  return {
    currentTask,
    completeTask,
    moveWaterTaskToEnd,
    tasks,
    isLoading,
    showIncomeModal,
    setShowIncomeModal,
    incomeInput,
    setIncomeInput,
  };
};
