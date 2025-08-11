// routes/drinkWaterRoute.js
import express from "express";
import {
  getDrinkWaterByUserId,
  createDrinkWater,
  deleteDrinkWater,
  getSummaryByUserId,
} from "../controllers/drinkWaterController.js";

const router = express.Router();

// Optional sanity check: GET /api/drinkWater
router.get("/", (req, res) => res.json({ ok: true, scope: "drinkWater" }));

// Put specific routes BEFORE the generic param route
router.get("/summary/:userId", getSummaryByUserId);
router.get("/:userId", getDrinkWaterByUserId);

router.post("/", createDrinkWater);
router.delete("/:id", deleteDrinkWater);

export default router;
