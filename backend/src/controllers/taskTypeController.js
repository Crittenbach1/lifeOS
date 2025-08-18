// backend/src/controllers/taskTypeController.js
import { sql } from "../config/db.js";

/** -------------------- Helpers -------------------- **/

// "HH:MM" 24-hour, 00..23 : 00..59
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validateSchedules(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return false;
  for (const entry of schedules) {
    if (
      typeof entry !== "object" ||
      entry == null ||
      typeof entry.dayOfWeek !== "number" ||
      entry.dayOfWeek < 0 ||
      entry.dayOfWeek > 6 ||
      !Array.isArray(entry.times) ||
      entry.times.length === 0
    ) {
      return false;
    }
    for (const t of entry.times) {
      if (typeof t !== "string" || !HHMM_RE.test(t)) return false;
    }
  }
  return true;
}

function sanitizeCategories(categories) {
  if (categories == null) return [];
  if (!Array.isArray(categories)) return [];
  // keep only non-empty strings, trim
  const out = [];
  const seen = new Set();
  for (const c of categories) {
    if (typeof c !== "string") continue;
    const v = c.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** -------------------- Controllers -------------------- **/

// GET /taskType/user/:userId
export async function getTaskTypesByUserId(req, res) {
  try {
    const { userId } = req.params;

    const rows = await sql`
      SELECT *
      FROM tasktype
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
    `;

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error getting task types", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// GET /taskType/:id
export async function getTaskTypeById(req, res) {
  try {
    const { id } = req.params;

    const rows = await sql`
      SELECT *
      FROM tasktype
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ message: "taskType not found" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error getting task type by id", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// POST /taskType
export async function createTaskType(req, res) {
    console.log("hi");
  try {
    const {
      user_id,
      name,
      schedules,
      priority,
      trackBy,
      categories, // optional
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,   // optional, defaults true
    } = req.body;

    // ---- Validation (mirror the client rules) ----
    if (!user_id) {
      return res.status(400).json({ message: "user_id is required" });
    }
    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ message: "name must be at least 2 characters" });
    }
    const pr = Number(priority ?? 1);
    if (!Number.isFinite(pr) || pr < 1 || pr > 10) {
      return res.status(400).json({ message: "priority must be an integer between 1 and 10" });
    }
    if (typeof trackBy !== "string" || trackBy.trim().length === 0) {
      return res.status(400).json({ message: "trackBy is required" });
    }
    if (!validateSchedules(schedules)) {
      return res.status(400).json({ message: "schedules must be non-empty and times in HH:MM 24h format" });
    }

    const yg = Number(yearlyGoal);
    const mg = Number(monthlyGoal);
    const wg = Number(weeklyGoal);
    const dg = Number(dailyGoal);
    for (const [label, n] of [
      ["yearlyGoal", yg],
      ["monthlyGoal", mg],
      ["weeklyGoal", wg],
      ["dailyGoal", dg],
    ]) {
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ message: `${label} must be a number greater than 0` });
      }
    }

    const cats = sanitizeCategories(categories);
    const active = is_active === undefined ? true : Boolean(is_active);

    // Postgres.js will serialize JS objects to JSONB and arrays to SQL arrays automatically.
    const inserted = await sql`
      INSERT INTO tasktype (
        user_id,
        name,
        schedules,
        priority,
        trackBy,
        categories,
        yearlyGoal,
        monthlyGoal,
        weeklyGoal,
        dailyGoal,
        is_active
      )
      VALUES (
        ${user_id},
        ${name.trim()},
        ${sql.json(schedules)},    -- JSONB
        ${pr},
        ${trackBy.trim()},
        ${cats},                   -- TEXT[]
        ${yg},
        ${mg},
        ${wg},
        ${dg},
        ${active}
      )
      RETURNING *
    `;

    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("Error creating task type", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// PATCH /taskType/:id
export async function updateTaskType(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      schedules,
      priority,
      trackBy,
      categories,
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,
    } = req.body;

    // Build dynamic SET clause
    const fields = [];
    if (typeof name === "string") fields.push(sql`name = ${name.trim()}`);
    if (schedules !== undefined) {
      if (!validateSchedules(schedules)) {
        return res.status(400).json({ message: "Invalid schedules (use HH:MM 24h times)" });
      }
      fields.push(sql`schedules = ${sql.json(schedules)}`);
    }
    if (priority !== undefined) {
      const pr = Number(priority);
      if (!Number.isFinite(pr) || pr < 1 || pr > 10) {
        return res.status(400).json({ message: "priority must be 1..10" });
      }
      fields.push(sql`priority = ${pr}`);
    }
    if (typeof trackBy === "string") fields.push(sql`trackBy = ${trackBy.trim()}`);
    if (categories !== undefined) fields.push(sql`categories = ${sanitizeCategories(categories)}`);
    if (yearlyGoal !== undefined) fields.push(sql`yearlyGoal = ${Number(yearlyGoal)}`);
    if (monthlyGoal !== undefined) fields.push(sql`monthlyGoal = ${Number(monthlyGoal)}`);
    if (weeklyGoal !== undefined) fields.push(sql`weeklyGoal = ${Number(weeklyGoal)}`);
    if (dailyGoal !== undefined) fields.push(sql`dailyGoal = ${Number(dailyGoal)}`);
    if (is_active !== undefined) fields.push(sql`is_active = ${Boolean(is_active)}`);

    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    fields.push(sql`updated_at = NOW()`);

    const updated = await sql`
      UPDATE tasktype
      SET ${sql.join(fields, sql`, `)}
      WHERE id = ${id}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({ message: "taskType not found" });
    }

    res.status(200).json(updated[0]);
  } catch (error) {
    console.error("Error updating task type", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// DELETE /taskType/:id
export async function deleteTaskType(req, res) {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM tasktype
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ message: "taskType not found" });
    }

    res.status(200).json({ message: "taskType deleted successfully" });
  } catch (error) {
    console.error("Error deleting task type", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
