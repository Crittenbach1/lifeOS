import express from "express";
import {
  getDrinkWaterByUserId,
  createDrinkWater,
  deleteDrinkWater,
  getDrinkWaterSummaryByUserId,
} from "../controllers/drinkWaterController.js";

const router = express.Router();

router.get("/:userId", getDrinkWaterByUserId);
router.post("/", createDrinkWater);
router.delete("/:id", deleteDrinkWater);
router.get("/summary/:userId", getDrinkWaterSummaryByUserId);

export default router;
