import { sql } from "../config/db.js";

export async function getBikeRidesByUserId(req, res) {
        try {
            const { userId } = req.params;
    
            const bikeRides = await sql`
                SELECT * FROM bikeRides
                WHERE user_id = ${userId}
                ORDER BY created_at DESC
            `;
    
            res.status(200).json(bikeRides);
        } catch (error) {
            console.log("Error getting the bikerides", error);
            res.status(500).json({ message: "Internal server error" });
        }
}

export async function createBikeRide(req, res) {
    try {
            const { user_id, lengthInSeconds, created_at, start_time } = req.body;
    
            if (!user_id || lengthInSeconds === undefined || !created_at) {
                return res.status(400).json({ message: "All fields are required" });
            }
    
            const bikeRide = await sql`
                INSERT INTO bikeRides (user_id, lengthInSeconds, created_at, start_time)
                VALUES (${user_id}, ${lengthInSeconds}, ${created_at}, ${start_time})
                RETURNING *
            `;
    
            console.log(bikeRide);
            res.status(201).json(bikeRide[0]);
        } catch (error) {
            console.log("Error creating the bikeride", error);
            res.status(500).json({ message: "Internal server error" });
        }
}

export async function deleteBikeRide(req,res) {
    try {
            const { id } = req.params;
    
            const result = await sql`
                DELETE FROM bikeRides
                WHERE id = ${id}
                RETURNING *
            `;
    
            if (result.length === 0) {
                return res.status(404).json({ message: "bikeride not found" });
            }
    
            res.status(200).json({ message: "bikeride deleted successfully" });
        } catch (error) {
            console.log("Error deleting the bikeride", error);
            res.status(500).json({ message: "Internal server error" });
        }
}

export async function getBikeRideSummaryByUserId(req, res) {
  console.log(new Date().toLocaleDateString('en-CA'));
  const today = new Date().toLocaleDateString('en-CA'); 

    // Get the current date and start of week (Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek); // move back to Sunday
  const weekStartString = weekStart.toLocaleDateString('en-CA'); // format to "YYYY-MM-DD"

  try {
    const { userId } = req.params;

    const minutesToday = await sql`
      SELECT ROUND(COALESCE(SUM(lengthInSeconds), 0) / 60.0, 2) AS minutes
      FROM bikeRides
      WHERE user_id = ${userId}
        AND created_at = ${today}
    `;

    const minutesThisWeek = await sql`
      SELECT ROUND(COALESCE(SUM(lengthInSeconds), 0) / 60.0, 2) AS minutes
      FROM bikeRides
      WHERE user_id = ${userId}
        AND created_at >= ${weekStartString}
        AND created_at <= ${today}
    `;

    const minutesThisMonth = await sql`
      SELECT ROUND(COALESCE(SUM(lengthInSeconds), 0) / 60.0, 2) AS minutes
      FROM bikeRides
      WHERE user_id = ${userId}
      AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `;

    const minutesThisYear = await sql`
      SELECT ROUND(COALESCE(SUM(lengthInSeconds), 0) / 60.0, 2) AS minutes
      FROM bikeRides
      WHERE user_id = ${userId}
      AND date_trunc('year', created_at) = date_trunc('year', CURRENT_DATE)
    `;

    res.json({
      today: parseFloat(minutesToday[0].minutes),
      thisWeek: parseFloat(minutesThisWeek[0].minutes),
      thisMonth: parseFloat(minutesThisMonth[0].minutes),
      thisYear: parseFloat(minutesThisYear[0].minutes),
    });
  } catch (error) {
    console.error("Error getting bikeride summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}