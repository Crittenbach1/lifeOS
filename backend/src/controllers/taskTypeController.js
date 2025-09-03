// backend/src/controllers/taskTypeController.js
import { sql } from "../config/db.js";

/** -------------------- Helpers -------------------- **/

// "HH:MM" 24-hour, 00..23 : 00..59
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

// Allow [] to mean "unscheduled"
function validateSchedules(schedules) {
  if (schedules == null) return true; // treat missing as unscheduled
  if (!Array.isArray(schedules)) return false;
  if (schedules.length === 0) return true; // unscheduled OK
  for (const entry of schedules) {
    if (
      typeof entry !== "object" ||
      entry == null ||
      typeof entry.dayOfWeek !== "number" ||
      entry.dayOfWeek < 0 ||
      entry.dayOfWeek > 6 ||
      !Array.isArray(entry.times)
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

/**
 * Build a SQL fragment for a Postgres TEXT[] value without using sql.join.
 * If empty -> ARRAY[]::text[]
 * Else     -> ARRAY(SELECT json_array_elements_text($json::json))::text[]
 */
function categoriesArrayExpr(values) {
  const cats = sanitizeCategories(values);
  if (cats.length === 0) {
    return sql`ARRAY[]::text[]`;
    // returns a typed empty text[]
  }
  return sql`ARRAY(SELECT json_array_elements_text(${JSON.stringify(cats)}::json))::text[]`;
}

function coerceNonNegativeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.trunc(n);
}

function coerceNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
      schedules,        // [] allowed for unscheduled
      priority,
      trackBy,
      categories,       // optional
      defaultAmount,    // optional, nullable
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,
    } = req.body;

    // ---- Validation ----
    if (!user_id) return res.status(400).json({ message: "user_id is required" });

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
      return res
        .status(400)
        .json({ message: "Invalid schedules (use HH:MM 24h times or leave empty for unscheduled)" });
    }

    // Goals: allow >= 0
    const yg = coerceNonNegativeInt(yearlyGoal, 0);
    const mg = coerceNonNegativeInt(monthlyGoal, 0);
    const wg = coerceNonNegativeInt(weeklyGoal, 0);
    const dg = coerceNonNegativeInt(dailyGoal, 0);

    const active = is_active === undefined ? true : Boolean(is_active);
    const schedJson = Array.isArray(schedules) ? schedules : [];

    const defAmt = coerceNullableNumber(defaultAmount);

    // NOTE: unquoted, lowercase column names
    const inserted = await sql`
      INSERT INTO tasktype (
        user_id, name, schedules, priority, trackby, categories,
        defaultamount,
        yearlygoal, monthlygoal, weeklygoal, dailygoal, is_active
      )
      VALUES (
        ${user_id},
        ${name.trim()},
        ${JSON.stringify(schedJson)}::jsonb,
        ${pr},
        ${trackBy.trim()},
        ${categoriesArrayExpr(categories)},
        ${defAmt},
        ${yg}, ${mg}, ${wg}, ${dg},
        ${active}
      )
      RETURNING *
    `;

    res.status(201).json(inserted[0]);
  } catch (error) {
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
      defaultAmount,
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,
    } = req.body;

    // Validate when present
    if (schedules !== undefined && !validateSchedules(schedules)) {
      return res.status(400).json({
        message: "Invalid schedules (use HH:MM 24h times or leave empty for unscheduled)",
      });
    }
    if (priority !== undefined) {
      const pr = Number(priority);
      if (!Number.isFinite(pr) || pr < 1 || pr > 10) {
        return res.status(400).json({ message: "priority must be 1..10" });
      }
    }

    // Build expressions (NULL means “leave unchanged” via COALESCE below)
    const nameExpr   = name         === undefined ? sql`NULL` : sql`${String(name).trim()}`;
    const trackExpr  = trackBy      === undefined ? sql`NULL` : sql`${String(trackBy).trim()}`;
    const prExpr     = priority     === undefined ? sql`NULL` : sql`${Number(priority)}`;
    const schedExpr  = schedules    === undefined ? sql`NULL` : sql`${JSON.stringify(Array.isArray(schedules) ? schedules : [])}::jsonb`;
    const catsExpr   = categories   === undefined ? sql`NULL` : categoriesArrayExpr(categories);
    const defAmtExpr = defaultAmount=== undefined ? sql`NULL` : sql`${coerceNullableNumber(defaultAmount)}`;
    const ygExpr     = yearlyGoal   === undefined ? sql`NULL` : sql`${coerceNonNegativeInt(yearlyGoal, 0)}`;
    const mgExpr     = monthlyGoal  === undefined ? sql`NULL` : sql`${coerceNonNegativeInt(monthlyGoal, 0)}`;
    const wgExpr     = weeklyGoal   === undefined ? sql`NULL` : sql`${coerceNonNegativeInt(weeklyGoal, 0)}`;
    const dgExpr     = dailyGoal    === undefined ? sql`NULL` : sql`${coerceNonNegativeInt(dailyGoal, 0)}`;
    const actExpr    = is_active    === undefined ? sql`NULL` : sql`${Boolean(is_active)}`;

    // One UPDATE with COALESCE keeps current value when incoming is NULL
    // NOTE: all column names are unquoted lowercase to match the table
    const updated = await sql`
      UPDATE tasktype
      SET
        name          = COALESCE(${nameExpr}, name),
        schedules     = COALESCE(${schedExpr}, schedules),
        priority      = COALESCE(${prExpr}, priority),
        trackby       = COALESCE(${trackExpr}, trackby),
        categories    = COALESCE(${catsExpr}, categories),
        defaultamount = COALESCE(${defAmtExpr}, defaultamount),
        yearlygoal    = COALESCE(${ygExpr}, yearlygoal),
        monthlygoal   = COALESCE(${mgExpr}, monthlygoal),
        weeklygoal    = COALESCE(${wgExpr}, weeklygoal),
        dailygoal     = COALESCE(${dgExpr}, dailygoal),
        is_active     = COALESCE(${actExpr}, is_active),
        updated_at    = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({ message: "taskType not found" });
    }

    res.status(200).json(updated[0]);
  } catch (error) {
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
