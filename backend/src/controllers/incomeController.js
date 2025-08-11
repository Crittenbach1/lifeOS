// backend/src/controllers/incomeController.js
import { sql } from "../config/db.js";

/** GET /income/:userId */
export async function getIncomeByUserId(req, res) {
  try {
    const { userId } = req.params;

    const incomes = await sql`
      SELECT *
      FROM income
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
    `;

    res.status(200).json(incomes);
  } catch (error) {
    console.error("Error getting the incomes", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/** POST /income */
export async function createIncome(req, res) {
  try {
    const { user_id, amount, minutes_worked, created_at } = req.body;

    // created_at is optional; default to CURRENT_DATE in SQL
    if (!user_id || amount === undefined || minutes_worked === undefined) {
      return res
        .status(400)
        .json({ message: "user_id, amount, and minutes_worked are required" });
    }

    const inserted = await sql`
      INSERT INTO income (user_id, amount, created_at, minutes_worked)
      VALUES (
        ${user_id},
        ${amount},
        COALESCE(${created_at}::date, CURRENT_DATE),
        ${minutes_worked}
      )
      RETURNING *
    `;

    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("Error creating the income", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/** DELETE /income/:id */
export async function deleteIncome(req, res) {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM income
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ message: "income not found" });
    }

    res.status(200).json({ message: "income deleted successfully" });
  } catch (error) {
    console.error("Error deleting the income", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/** GET /income/summary/:userId */
export async function getIncomeSummaryByUserId(req, res) {
  try {
    const { userId } = req.params;

    const today = await sql`
      SELECT
        COALESCE(SUM(amount), 0)         AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND created_at = CURRENT_DATE
    `;

    const thisWeek = await sql`
      SELECT
        COALESCE(SUM(amount), 0)         AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND created_at >= date_trunc('week', CURRENT_DATE)::date
        AND created_at <= CURRENT_DATE
    `;

    const thisMonth = await sql`
      SELECT
        COALESCE(SUM(amount), 0)         AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `;

    const thisYear = await sql`
      SELECT
        COALESCE(SUM(amount), 0)         AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND date_trunc('year', created_at) = date_trunc('year', CURRENT_DATE)
    `;

    res.json({
      today: {
        income: parseFloat(today[0].total_income),
        minutesWorked: Number(today[0].total_minutes),
      },
      thisWeek: {
        income: parseFloat(thisWeek[0].total_income),
        minutesWorked: Number(thisWeek[0].total_minutes),
      },
      thisMonth: {
        income: parseFloat(thisMonth[0].total_income),
        minutesWorked: Number(thisMonth[0].total_minutes),
      },
      thisYear: {
        income: parseFloat(thisYear[0].total_income),
        minutesWorked: Number(thisYear[0].total_minutes),
      },
    });
  } catch (error) {
    console.error("Error getting income summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
