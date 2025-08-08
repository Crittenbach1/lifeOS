import { format, parseISO } from "date-fns";

/**
 * @param {Array} rides - Array of bike ride objects with .created_at and .lengthinseconds
 * @returns {Array} - Array of 5 items like [{ label: 'Mar', minutes: 123 }, ...]
 */
export const getLastFiveMonthsSummary = (rides) => {
  const now = new Date();
  const months = [];

  // Initialize months array with past 5 months
  for (let i = 4; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = format(date, "MMM");
    const key = format(date, "yyyy-MM"); // e.g., "2024-03"
    months.push({ key, label, minutes: 0 });
  }

  // Sum minutes per month
  rides.forEach((ride) => {
    const rideDate = parseISO(ride.created_at);
    const key = format(rideDate, "yyyy-MM");
    const monthEntry = months.find((m) => m.key === key);
    if (monthEntry) {
      const minutes = Math.round((ride.lengthinseconds ?? 0) / 60);
      monthEntry.minutes += minutes;
    }
  });

  // Return formatted for chart
  return months.map(({ label, minutes }) => ({ label, minutes }));
};
