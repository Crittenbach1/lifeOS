import { sql } from "../config/db.js";

export async function getIncomesByUserId(req, res) {
        try {
            const { userId } = req.params;
    
            const incomes = await sql`
                SELECT * FROM income
                WHERE user_id = ${userId}
                ORDER BY created_at DESC
            `;
    
            res.status(200).json(incomes);
        } catch (error) {
            console.log("Error getting the incomes", error);
            res.status(500).json({ message: "Internal server error" });
        }
}

export async function createIncome(req, res) {
    try {
            const { user_id, amount, created_at, minutes_worked } = req.body;
    
            if (!user_id || amount === undefined || minutes_worked === undefined || !created_at) {
                return res.status(400).json({ message: "All fields are required" });
            }
    
            const income = await sql`
                INSERT INTO income (user_id, amount, created_at, minutes_worked)
                VALUES (${user_id}, ${amount}, ${created_at}, ${minutes_worked})
                RETURNING *
            `;
    
            console.log(income);
            res.status(201).json(income[0]);
        } catch (error) {
            console.log("Error creating the income", error);
            res.status(500).json({ message: "Internal server error" });
        }
}

export async function deleteIncome(req,res) {
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
            console.log("Error deleting the income", error);
            res.status(500).json({ message: "Internal server error" });
        }
}

export async function getSummaryByUserId(req, res) {
  console.log(new Date().toLocaleDateString('en-CA'));
  const today = new Date().toLocaleDateString('en-CA');

  // Get start of the week (Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartString = weekStart.toLocaleDateString('en-CA');

  try {
    const { userId } = req.params;

    const incomeToday = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND created_at = ${today}
    `;

    const incomeThisWeek = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND created_at >= ${weekStartString}
        AND created_at <= ${today}
    `;

    const incomeThisMonth = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `;

    const incomeThisYear = await sql`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_income,
        COALESCE(SUM(minutes_worked), 0) AS total_minutes
      FROM income
      WHERE user_id = ${userId}
        AND date_trunc('year', created_at) = date_trunc('year', CURRENT_DATE)
    `;

    res.json({
      today: {
        income: parseFloat(incomeToday[0].total_income),
        minutesWorked: parseInt(incomeToday[0].total_minutes),
      },
      thisWeek: {
        income: parseFloat(incomeThisWeek[0].total_income),
        minutesWorked: parseInt(incomeThisWeek[0].total_minutes),
      },
      thisMonth: {
        income: parseFloat(incomeThisMonth[0].total_income),
        minutesWorked: parseInt(incomeThisMonth[0].total_minutes),
      },
      thisYear: {
        income: parseFloat(incomeThisYear[0].total_income),
        minutesWorked: parseInt(incomeThisYear[0].total_minutes),
      },
    });
  } catch (error) {
    console.error("Error getting income summary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
