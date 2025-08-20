// routes/taskItemRoutes.js
import { Router } from "express";
import {
  getTaskItemsByTaskType,
  getTaskItemById,
  createTaskItem,
  deleteTaskItem,
} from "../controllers/taskItemController.js";

const router = Router();

// Important: this must come before "/:id" so "type" isn't captured as an id
router.get("/type/:taskTypeID", getTaskItemsByTaskType);

router.get("/:id", getTaskItemById);
router.post("/", createTaskItem);
router.delete("/:id", deleteTaskItem);

export default router;
