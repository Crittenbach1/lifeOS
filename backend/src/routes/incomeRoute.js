import express from "express";
import {getIncomesByUserId, createIncome, deleteIncome, getSummaryByUserId} from "../controllers/incomeController.js";

const router = express.Router();
 
router.get("/:userId", getIncomesByUserId);
router.post("/", createIncome);
router.delete("/:id", deleteIncome);
router.get("/summary/:userId", getSummaryByUserId);

export default router;
