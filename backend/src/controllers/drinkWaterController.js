// backend/src/controllers/drinkWaterController.js
import { sql } from "../config/db.js";


export async function getDrinkWaterByUserId(req, res) {
  try {
    const { userId } = req.params;

    const drinks = await sql`
      SELECT *
      FROM drinkwater
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
    `;

    res.status(200).json(drinks);
  } catch (error) {
    console.error("Error getting drink water entries", error);
    res.status(500).json({ message: "Internal server error" });
  }
}


export async function createDrinkWater(req, res) {
  try {
    const { user_id, amount, created_at } = req.body;

    if (!user_id || amount === undefined) {
      return res
        .status(400)
        .json({ message: "user_id and amount are required" });
    }

    const inserted = await sql`
      INSERT INTO drinkwater (user_id, amount, created_at)
      VALUES (
        ${user_id},
        ${amount},
        COALESCE(${created_at}::date, CURRENT_DATE)
      )
      RETURNING *
    `;

    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("Error creating drink water entry", error);
    res.status(500).json({ message: "Internal server error" });
  }
}


export async function deleteDrinkWater(req, res) {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM drinkwater
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ message: "drinkWater entry not found" });
    }

    res.status(200).json({ message: "drinkWater entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting drink water entry", error);
    res.status(500).json({ message: "Internal server error" });
  }
}


export async function getDrinkWaterSummaryByUserId(req, res) {
  try {
    const { userId } = req.params;

    const today = await sql`
      SELECT
        COALESCE(SUM(amount), 0) AS total_amount,
        COUNT(*)::int            AS total_count
      FROM drinkwater
      WHERE user_id = ${userId}
        AND created_at = CURRENT_DATE
    `;

    const thisWeek = await sql`
      SELECT
        COALESCE(SUM(amount), 0) AS total_amount,
        COUNT(*)::int            AS total_count
      FROM drinkwater
      WHERE user_id = ${userId}
        AND created_at >= date_trunc('week', CURRENT_DATE)::date
        AND created_at <= CURRENT_DATE
    `;

    const thisMonth = await sql`
      SELECT
        COALESCE(SUM(amount), 0) AS total_amount,
        COUNT(*)::int            AS total_count
      FROM drinkwater
      WHERE user_id = ${userId}
        AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `;

    const thisYear = await sql`
      SELECT
        COALESCE(SUM(amount), 0) AS total_amount,
        COUNT(*)::int            AS total_count
      FROM drinkwater
      WHERE user_id = ${userId}
        AND date_trunc('year', created_at) = date_trunc('year', CURRENT_DATE)
    `;

    res.json({
      today: {
        amount: parseFloat(today[0].total_amount),
        count: Number(today[0].total_count),
      },
      thisWeek: {
        amount: parseFloat(thisWeek[0].total_amount),
        count: Number(thisWeek[0].total_count),
      },
      thisMonth: {
        amount: parseFloat(thisMonth[0].total_amount),
        count: Number(thisMonth[0].total_count),
      },
      thisYear: {
        amount: parseFloat(thisYear[0].total_amount),
        count: Number(thisYear[0].total_count),
      },
    });
  } catch (error) {
    console.error("Error getting drinkWater summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
