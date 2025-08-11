import express from "express";
import {getBikeRidesByUserId, createBikeRide, deleteBikeRide, getBikeRideSummaryByUserId} from "../controllers/bikeRidesController.js";

const router = express.Router();
 
router.get("/:userId", getBikeRidesByUserId);
router.post("/", createBikeRide);
router.delete("/:id", deleteBikeRide);
router.get("/summary/:userId", getBikeRideSummaryByUserId);

export default router;

