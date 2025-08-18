import { Router } from "express";
import {
  getTaskTypesByUserId,
  getTaskTypeById,
  createTaskType,
  updateTaskType,
  deleteTaskType,
} from "../controllers/taskTypeController.js";

const router = Router();

router.get("/user/:userId", getTaskTypesByUserId);
router.get("/:id", getTaskTypeById);
router.post("/", createTaskType);
router.patch("/:id", updateTaskType);
router.delete("/:id", deleteTaskType);

export default router;
