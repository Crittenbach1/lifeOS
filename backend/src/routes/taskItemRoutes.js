import { Router } from "express";
import {
  getTaskItemsByUserId,
  getTaskItemById,
  createTaskItem,
  deleteTaskItem,
} from "../controllers/taskItemController.js";

const router = Router();

router.get("/user/:userId", getTaskItemsByUserId);
router.get("/:id", getTaskItemById);
router.post("/", createTaskItem);
router.delete("/:id", deleteTaskItem);

export default router;
