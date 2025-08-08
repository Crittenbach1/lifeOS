// lib/utils.js
import { API_URL } from "../constants/api";

export function formatDate(dateString) {
  // format date nicely
  // example: from this 👉 2025-05-20 to this 👉 May 20, 2025
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const logBikeRide = async ({ userId, seconds = 60 }) => {
  const now = new Date();
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const response = await fetch(`${API_URL}/BikeRides`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      lengthInSeconds: seconds,
      created_at: now.toISOString(),
      start_time: formattedTime,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to log bike ride");
  }

  return await response.json();
};

export const logIncome = async ({ userId, amount, minutesWorked }) => {
  const now = new Date();
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const response = await fetch(`${API_URL}/Income`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      amount,
      minutes_worked: minutesWorked,
      created_at: now.toISOString(),
      start_time: formattedTime, // optional: not used in the backend but good for display
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to log income");
  }

  return await response.json();
};