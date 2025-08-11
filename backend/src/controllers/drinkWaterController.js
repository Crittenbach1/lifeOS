// controllers/drinkWaterController.js
import { sql } from "../config/db.js";

/**
 * GET /api/drink-water/:userId
 * Returns all drinkWater rows for a user (newest first).
 */
export async function getDrinkWaterByUserId(req, res) {
  try {
    const { userId } = req.params;

    const rows = await sql`
      SELECT id, user_id, amount, created_at
      FROM drinkWater
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
    `;

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error getting drinkWaters", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * POST /api/drink-water
 * Body: { user_id: string, amount: number, created_at?: "YYYY-MM-DD" }
 * Inserts a new water entry. If created_at is omitted, DB default is CURRENT_DATE.
 */
export async function createDrinkWater(req, res) {
  try {
    const { user_id, amount, created_at } = req.body;

    if (!user_id || amount === undefined) {
      return res
        .status(400)
        .json({ message: "user_id and amount are required" });
    }
    if (Number.isNaN(Number(amount))) {
      return res.status(400).json({ message: "amount must be a number" });
    }

    const inserted = await sql`
      INSERT INTO drinkWater (user_id, amount${created_at ? sql`, created_at` : sql``})
      VALUES (${user_id}, ${amount}${created_at ? sql`, ${created_at}` : sql``})
      RETURNING id, user_id, amount, created_at
    `;

    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("Error creating drinkWater", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * DELETE /api/drink-water/:id
 * Deletes a single drinkWater row by id.
 */
export async function deleteDrinkWater(req, res) {
  try {
    const { id } = req.params;

    const deleted = await sql`
      DELETE FROM drinkWater
      WHERE id = ${id}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return res.status(404).json({ message: "drinkWater entry not found" });
    }

    res.status(200).json({ message: "drinkWater entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting drinkWater", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * GET /api/drink-water/summary/:userId
 * Returns totals for today, thisWeek (Sun–today), thisMonth, thisYear.
 */
export async function getSummaryByUserId(req, res) {
  try {
    const { userId } = req.params;

    // Compute date boundaries in SQL to avoid locale issues
    const [today, weekStart] = await sql`
      WITH nowdates AS (
        SELECT CURRENT_DATE AS today,
               (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT) AS week_start -- Sunday
      )
      SELECT today, week_start FROM nowdates
    `;

    const todayDate = today[0].today;           // e.g. 2025-08-11
    const weekStartDate = weekStart[0].week_start;

    const [sumToday, sumWeek, sumMonth, sumYear] = await Promise.all([
      sql`
        SELECT COALESCE(SUM(amount), 0)::float AS total
        FROM drinkWater
        WHERE user_id = ${userId} AND created_at = ${todayDate}
      `,
      sql`
        SELECT COALESCE(SUM(amount), 0)::float AS total
        FROM drinkWater
        WHERE user_id = ${userId}
          AND created_at >= ${weekStartDate}
          AND created_at <= ${todayDate}
      `,
      sql`
        SELECT COALESCE(SUM(amount), 0)::float AS total
        FROM drinkWater
        WHERE user_id = ${userId}
          AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
      `,
      sql`
        SELECT COALESCE(SUM(amount), 0)::float AS total
        FROM drinkWater
        WHERE user_id = ${userId}
          AND date_trunc('year', created_at) = date_trunc('year', CURRENT_DATE)
      `,
    ]);

    res.json({
      today: sumToday[0].total,
      thisWeek: sumWeek[0].total,
      thisMonth: sumMonth[0].total,
      thisYear: sumYear[0].total,
    });
  } catch (error) {
    console.error("Error getting drinkWater summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
