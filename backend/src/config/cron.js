// backend/src/config/cron.js
import cron from "node-cron";
import https from "https";

// Runs every 14 minutes, but won't start until you call job.start()
export const job = cron.schedule(
  "*/14 * * * *",
  () => {
    const url = process.env.API_URL; // e.g. https://your-render-url.onrender.com/api/health
    if (!url) {
      console.warn("[cron] API_URL not set");
      return;
    }

    https
      .get(url, (res) => {
        if (res.statusCode === 200) {
          console.log("[cron] ping ok");
        } else {
          console.log("[cron] ping failed:", res.statusCode);
        }
      })
      .on("error", (e) => console.error("[cron] error:", e));
  },
  { scheduled: false }
);
