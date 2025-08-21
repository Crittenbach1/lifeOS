import { sql } from "../config/db.js";

/** -------------------- Helpers -------------------- **/

// "HH:MM" 24-hour, 00..23 : 00..59
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

// Your original strict validator (schedules must be non-empty & valid)
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

/**
 * Accept categories as:
 *  - array: ["A","B","C"]
 *  - comma string: "A, B, C"
 *  - JSON string: '["A","B","C"]'
 * Dedupes (case-insensitive), trims, and drops empties.
 */
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

/**
 * Build a TEXT[] expression without sql.join / sql.array:
 * - If values is undefined -> NULL (so COALESCE can keep old value)
 * - Else -> ARRAY(SELECT jsonb_array_elements_text($1::jsonb))
 */
function categoriesArrayExprOrNull(values) {
  if (values === undefined) return sql`NULL`;
  const cats = coerceCategories(values);
  const json = JSON.stringify(cats);
  return sql`COALESCE(ARRAY(SELECT jsonb_array_elements_text(${json}::jsonb)), ARRAY[]::text[])`;
}

// Non-NULL variant for INSERT (always returns a text[])
function categoriesArrayExpr(values) {
  const cats = coerceCategories(values);
  const json = JSON.stringify(cats);
  return sql`COALESCE(ARRAY(SELECT jsonb_array_elements_text(${json}::jsonb)), ARRAY[]::text[])`;
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
      trackBy,              // you said trackBy/trackby is fine on your side
      categories,           // array / comma string / JSON string
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,
    } = req.body ?? {};

    // ---- Validation (unchanged, schedules still required) ----
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
        .json({ message: "schedules must be non-empty and times in HH:MM 24h format" });
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

    const active = is_active === undefined ? true : Boolean(is_active);

    const inserted = await sql`
      INSERT INTO tasktype (
        user_id, name, schedules, priority, trackby, categories,
        yearlyGoal, monthlyGoal, weeklyGoal, dailyGoal, is_active
      )
      VALUES (
        ${user_id},
        ${name.trim()},
        ${JSON.stringify(schedules)}::jsonb,
        ${pr},
        ${trackBy.trim()},
        ${categoriesArrayExpr(categories)},
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
      yearlyGoal,
      monthlyGoal,
      weeklyGoal,
      dailyGoal,
      is_active,
    } = req.body ?? {};

    // If nothing is provided, bail early
    const hasAny =
      name !== undefined ||
      schedules !== undefined ||
      priority !== undefined ||
      trackBy !== undefined ||
      categories !== undefined ||
      yearlyGoal !== undefined ||
      monthlyGoal !== undefined ||
      weeklyGoal !== undefined ||
      dailyGoal !== undefined ||
      is_active !== undefined;

    if (!hasAny) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Validate inputs that are present
    if (schedules !== undefined) {
      if (!validateSchedules(schedules)) {
        return res.status(400).json({ message: "Invalid schedules (use HH:MM 24h times)" });
      }
    }
    if (priority !== undefined) {
      const pr = Number(priority);
      if (!Number.isFinite(pr) || pr < 1 || pr > 10) {
        return res.status(400).json({ message: "priority must be 1..10" });
      }
    }
    if (trackBy !== undefined && (typeof trackBy !== "string" || !trackBy.trim())) {
      return res.status(400).json({ message: "trackBy must be a non-empty string" });
    }

    // Build per-field expressions without using sql.join
    const nameExpr       = name       !== undefined ? sql`${name.trim()}` : sql`NULL`;
    const schedExpr      = schedules  !== undefined ? sql`${JSON.stringify(schedules)}::jsonb` : sql`NULL`;
    const prExpr         = priority   !== undefined ? sql`${Number(priority)}` : sql`NULL`;
    const trackByExpr    = trackBy    !== undefined ? sql`${trackBy.trim()}` : sql`NULL`;
    const catsExpr       = categoriesArrayExprOrNull(categories);
    const ygExpr         = yearlyGoal !== undefined ? sql`${Number(yearlyGoal)}` : sql`NULL`;
    const mgExpr         = monthlyGoal!== undefined ? sql`${Number(monthlyGoal)}` : sql`NULL`;
    const wgExpr         = weeklyGoal !== undefined ? sql`${Number(weeklyGoal)}` : sql`NULL`;
    const dgExpr         = dailyGoal  !== undefined ? sql`${Number(dailyGoal)}` : sql`NULL`;
    const activeExpr     = is_active  !== undefined ? sql`${Boolean(is_active)}` : sql`NULL`;

    const updated = await sql`
      UPDATE tasktype
      SET
        name        = COALESCE(${nameExpr}, name),
        schedules   = COALESCE(${schedExpr}, schedules),
        priority    = COALESCE(${prExpr}, priority),
        trackby     = COALESCE(${trackByExpr}, trackby),
        categories  = COALESCE(${catsExpr}, categories),
        yearlyGoal  = COALESCE(${ygExpr}, yearlyGoal),
        monthlyGoal = COALESCE(${mgExpr}, monthlyGoal),
        weeklyGoal  = COALESCE(${wgExpr}, weeklyGoal),
        dailyGoal   = COALESCE(${dgExpr}, dailyGoal),
        is_active   = COALESCE(${activeExpr}, is_active),
        updated_at  = NOW()
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
