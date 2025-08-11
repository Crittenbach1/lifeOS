import express from "express";
import {getIncomeByUserId, createIncome, deleteIncome, getIncomeSummaryByUserId} from "../controllers/incomeController.js";

const router = express.Router();
 
router.get("/:userId", getIncomeByUserId);
router.post("/", createIncome);
router.delete("/:id", deleteIncome);
router.get("/summary/:userId", getIncomeSummaryByUserId);

export default router;

