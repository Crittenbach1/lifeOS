// controllers/taskItemController.js
// Uses named import for `sql` and an inline error helper (Option A).

import { sql } from "../config/db.js";

// Inline error helper to avoid external utils dependency.
function logAnd500(res, message, error) {
  console.error(message, error);
  return res.status(500).json({ message });
}

/**
 * GET /api/taskItem/type/:taskTypeID
 * List taskItems for a given taskTypeID (most recent first)
 */
export async function getTaskItemsByTaskType(req, res) {
  try {
    const { taskTypeID } = req.params;
    if (!taskTypeID) {
      return res.status(400).json({ message: "taskTypeID is required" });
    }

    const rows = await sql`
      SELECT *
      FROM taskitem
      WHERE tasktypeid = ${taskTypeID}
      ORDER BY created_at DESC, id DESC
    `;
    return res.status(200).json(rows);
  } catch (error) {
    return logAnd500(res, "Error getting task items", error);
  }
}

/**
 * GET /api/taskItem/:id
 * Fetch a single taskItem by id
 */
export async function getTaskItemById(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "id is required" });
    }

    const rows = await sql`
      SELECT *
      FROM taskitem
      WHERE id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) {
      return res.status(404).json({ message: "taskItem not found" });
    }
    return res.status(200).json(rows[0]);
  } catch (error) {
    return logAnd500(res, "Error getting task item by id", error);
  }
}

/**
 * POST /api/taskItem
 * Create a taskItem
 * Body: { taskTypeID (required), name?, amount?, description?, taskCategory? }
 */
export async function createTaskItem(req, res) {
  try {
    const { taskTypeID, name, amount, description, taskCategory } = req.body;

    if (!taskTypeID) {
      return res.status(400).json({ message: "taskTypeID is required" });
    }

    // Coerce amount -> number or null (DECIMAL column accepts null)
    const amt =
      amount === undefined || amount === null || amount === ""
        ? null
        : Number(amount);
    if (amt !== null && Number.isNaN(amt)) {
      return res.status(400).json({ message: "amount must be numeric or null" });
    }

    const cleanName =
      typeof name === "string" && name.trim().length ? name.trim() : null;

    const inserted = await sql`
      INSERT INTO taskitem (tasktypeid, name, amount, description, taskcategory)
      VALUES (
        ${taskTypeID},
        ${cleanName},
        ${amt},
        ${description ?? null},
        ${taskCategory ?? null}
      )
      RETURNING *
    `;

    return res.status(201).json(inserted[0]);
  } catch (error) {
    return logAnd500(res, "Error creating task item", error);
  }
}

/**
 * DELETE /api/taskItem/:id
 * Delete a taskItem by id
 */
export async function deleteTaskItem(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "id is required" });
    }

    const result = await sql`
      DELETE FROM taskitem
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ message: "taskItem not found" });
    }

    return res.status(200).json({ message: "taskItem deleted successfully" });
  } catch (error) {
    return logAnd500(res, "Error deleting task item", error);
  }
}

/**
 * GET /api/taskItem/today/:userId?tz=America/New_York
 * Returns all task items the user completed "today" in the given timezone.
 * We infer user -> task items by joining through tasktype.user_id.
 *
 * Notes:
 * - Assumes `taskitem.created_at` is a timestamptz (recommended).
 * - If it's a naive timestamp, Postgres will treat it as local time on the DB server.
 */
export async function getTaskItemsTodayByUser(req, res) {
  try {
    const { userId } = req.params;
    const tz = (req.query.tz || "UTC").toString();

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Match "today" by converting both created_at and now() into the requested timezone,
    // then compare their DATE components.
    const rows = await sql`
      SELECT ti.*
      FROM taskitem ti
      JOIN tasktype tt ON tt.id = ti.tasktypeid
      WHERE tt.user_id = ${userId}
        AND (ti.created_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
      ORDER BY ti.created_at DESC, ti.id DESC
    `;

    return res.status(200).json(rows);
  } catch (error) {
    return logAnd500(res, "Error getting today's task items by user", error);
  }
}
