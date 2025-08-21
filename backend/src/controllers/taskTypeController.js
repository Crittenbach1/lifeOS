// backend/src/controllers/taskTypeController.js
import { sql } from "../config/db.js";

/** -------------------- Helpers -------------------- **/

// "HH:MM" 24-hour, 00..23 : 00..59
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

// Your original strict schedules validator (non-empty)
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

// categories: accept array, "a,b,c", or JSON string
function coerceCategories(input) {
  if (input == null) return [];
  let arr = [];
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === "string") {
    try {
      const j = JSON.parse(input);
      if (Array.isArray(j)) arr = j;
      else arr = String(input).split(",");
    } catch {
      arr = String(input).split(",");
    }
  } else {
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const c of arr) {
    const v = String(c).trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function parseDefaultAmount(val) {
  if (val === undefined) return undefined;    // not provided -> no change
  if (val === null || val === "") return null; // explicit null/empty -> NULL
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error("defaultAmount must be a number");
  return n;
}

function logAnd500(res, label, error) {
  console.error(label, {
    message: error?.message,
    detail: error?.detail,
    code: error?.code,
    stack: error?.stack,
  });
  return res
    .status(500)
    .json({ message: "Internal server error", detail: error?.detail, code: error?.code });
}

/** -------------------- Controllers -------------------- **/

// GET /api/taskType/user/:userId
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
    return logAnd500(res, "Error getting task types", error);
  }
}

// GET /api/taskType/:id
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
    return logAnd500(res, "Error getting task type by id", error);
  }
}

// POST /api/taskType
export async function createTaskType(req, res) {
  try {
    const {
      user_id,
      name,
      schedules,
      priority,
      trackBy,
      categories,
      defaultAmount,   // NEW
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,
    } = req.body ?? {};

    if (!user_id) return res.status(400).json({ message: "user_id is required" });
    if (typeof name !== "string" || name.trim().length < 2)
      return res.status(400).json({ message: "name must be at least 2 characters" });

    const pr = Number(priority ?? 1);
    if (!Number.isFinite(pr) || pr < 1 || pr > 10)
      return res.status(400).json({ message: "priority must be an integer between 1 and 10" });

    if (typeof trackBy !== "string" || trackBy.trim().length === 0)
      return res.status(400).json({ message: "trackBy is required" });

    if (!validateSchedules(schedules))
      return res.status(400).json({ message: "schedules must be non-empty and HH:MM 24h format" });

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

    const active = is_active === undefined ? true : Boolean(is_active);

    const cats = coerceCategories(categories);
    const da = parseDefaultAmount(defaultAmount); // number | null | undefined

    const inserted = await sql`
      INSERT INTO tasktype (
        user_id, name, schedules, priority, trackby, categories,
        defaultAmount,                                     -- NEW
        yearlyGoal, monthlyGoal, weeklyGoal, dailyGoal, is_active
      )
      VALUES (
        ${user_id},
        ${name.trim()},
        ${JSON.stringify(schedules)}::jsonb,
        ${pr},
        ${trackBy.trim()},
        ${cats.length ? sql`${sql.array(cats)}::text[]` : sql`ARRAY[]::text[]`},
        ${da ?? null},                                      -- driver handles numeric/null
        ${yg}, ${mg}, ${wg}, ${dg},
        ${active}
      )
      RETURNING *
    `;

    res.status(201).json(inserted[0]);
  } catch (error) {
    if (error?.message?.includes("defaultAmount")) {
      return res.status(400).json({ message: error.message });
    }
    return logAnd500(res, "Error creating task type", error);
  }
}

// PATCH /api/taskType/:id
export async function updateTaskType(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      schedules,
      priority,
      trackBy,
      categories,
      defaultAmount,   // NEW
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,
    } = req.body ?? {};

    const fields = [];

    if (typeof name === "string") fields.push(sql`name = ${name.trim()}`);

    if (schedules !== undefined) {
      if (!validateSchedules(schedules)) {
        return res.status(400).json({ message: "Invalid schedules (use HH:MM 24h times)" });
      }
      fields.push(sql`schedules = ${JSON.stringify(schedules)}::jsonb`);
    }

    if (priority !== undefined) {
      const pr = Number(priority);
      if (!Number.isFinite(pr) || pr < 1 || pr > 10) {
        return res.status(400).json({ message: "priority must be 1..10" });
      }
      fields.push(sql`priority = ${pr}`);
    }

    if (typeof trackBy === "string") fields.push(sql`trackby = ${trackBy.trim()}`);

    if (categories !== undefined) {
      const cats = coerceCategories(categories);
      fields.push(
        cats.length
          ? sql`categories = ${sql.array(cats)}::text[]`
          : sql`categories = ARRAY[]::text[]`
      );
    }

    if (defaultAmount !== undefined) {
      const da = parseDefaultAmount(defaultAmount); // number|null
      fields.push(sql`defaultAmount = ${da}`);
    }

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
    if (error?.message?.includes("defaultAmount")) {
      return res.status(400).json({ message: error.message });
    }
    return logAnd500(res, "Error updating task type", error);
  }
}

// DELETE /api/taskType/:id
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
    return logAnd500(res, "Error deleting task type", error);
  }
}
