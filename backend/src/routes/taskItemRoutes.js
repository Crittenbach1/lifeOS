// routes/taskItemRoutes.js
import { Router } from "express";
import {
  getTaskItemsByTaskType,
  getTaskItemById,
  createTaskItem,
  deleteTaskItem,
  getTaskItemsTodayByUser,
} from "../controllers/taskItemController.js";

const router = Router();

/**
 * Mounted at /api/taskItem
 * Final paths:
 *   GET    /api/taskItem/__probe
 *   GET    /api/taskItem/type/:taskTypeID
 *   GET    /api/taskItem/today/:userId
 *   GET    /api/taskItem/:id
 *   POST   /api/taskItem
 *   DELETE /api/taskItem/:id
 */

// Put probe FIRST so it isn't captured by "/:id"
router.get("/__probe", (_req, res) => res.json({ ok: true, base: "/api/taskItem" }));

// Put more-specific routes BEFORE the generic "/:id"
router.get("/type/:taskTypeID", getTaskItemsByTaskType);
router.get("/today/:userId", getTaskItemsTodayByUser);

// Generic catch-all by id LAST
router.get("/:id", getTaskItemById);

router.post("/", createTaskItem);
router.delete("/:id", deleteTaskItem);

export default router;
