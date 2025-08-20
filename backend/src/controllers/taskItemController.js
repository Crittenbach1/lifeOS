// GET /api/taskItem/user/:userId
export async function getTaskItemsByUserId(req, res) {
  try {
    const { userId } = req.params;
    const rows = await sql`
      SELECT *
      FROM taskitem
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
    `;
    res.status(200).json(rows);
  } catch (error) {
    return logAnd500(res, "Error getting task items", error);
  }
}

// GET /api/taskItem/:id
export async function getTaskItemById(req, res) {
  try {
    const { id } = req.params;
    const rows = await sql`
      SELECT *
      FROM tasktype
      WHERE id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) {
      return res.status(404).json({ message: "taskItem not found" });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    return logAnd500(res, "Error getting task type by id", error);
  }
}

// POST /api/taskItem
export async function createTaskType(req, res) {
  try {
    const {
      user_id,
      name,
      amount,
      description,
      taskCategory,
    } = req.body;

    // ---- Validation (mirror client) ----
    if (!user_id) return res.status(400).json({ message: "user_id is required" });

    const inserted = await sql`
      INSERT INTO taskItem (
        user_id, name, amount, description, taskCategory
      )
      VALUES (
        ${user_id},
        ${name.trim()},
        ${amount},
        ${description},
        ${taskCategory},
      )
      RETURNING *
    `;

    res.status(201).json(inserted[0]);
  } catch (error) {
    return logAnd500(res, "Error creating task item", error);
  }
}

// DELETE /api/taskType/:id
export async function deleteTaskItem(req, res) {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM tasktype
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ message: "taskItem not found" });
    }

    res.status(200).json({ message: "taskItem deleted successfully" });
  } catch (error) {
    return logAnd500(res, "Error deleting task item", error);
  }
}
