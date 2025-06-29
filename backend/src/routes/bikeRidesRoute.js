import express from "express";
import {getBikeRidesByUserId, createBikeRide, deleteBikeRide, getSummaryByUserId} from "../controllers/bikeRidesController.js";

const router = express.Router();
 
router.get("/:userId", getBikeRidesByUserId);
router.post("/", createBikeRide);
router.delete("/:id", deleteBikeRide);
router.get("/summary/:userId", getSummaryByUserId);

export default router;

