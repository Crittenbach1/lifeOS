import { v4 as uuidv4 } from 'uuid';

export const generateDailyTasks = () => {
  const today = new Date();
  today.setSeconds(0, 0);

  const tasks = [];

  // Bike every hour: 5am to 10pm
  for (let h = 5; h <= 22; h++) {
    const time = new Date(today);
    time.setHours(h, 0, 0, 0);
    tasks.push({
      id: uuidv4(),
      title: "Ride bike 1 minute",
      dueTime: time.toISOString(),
      completed: false,
    });
  }

  // Water at intervals
  const waterHours = [5, 8, 11, 14, 17, 20];
  for (const h of waterHours) {
    const time = new Date(today);
    time.setHours(h, 0, 0, 0);
    tasks.push({
      id: uuidv4(),
      title: "Drink water bottle",
      dueTime: time.toISOString(),
      completed: false,
    });
  }

  return tasks.sort((a, b) => new Date(a.dueTime) - new Date(b.dueTime));
};
