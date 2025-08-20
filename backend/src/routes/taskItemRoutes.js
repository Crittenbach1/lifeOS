import { Router } from "express";
import {
  getTaskItemsByUserId,
  getTaskItemById,
  createTaskItem,
  updateTaskItem,
  deleteTaskItem,
} from "../controllers/taskItemController.js";

const router = Router();

router.get("/user/:userId", getTaskItemsByUserId);
router.get("/:id", getTaskItemById);
router.post("/", createTaskItem);
router.patch("/:id", updateTaskItem);
router.delete("/:id", deleteTaskItem);

export default router;
