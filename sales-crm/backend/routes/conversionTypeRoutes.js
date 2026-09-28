import express from "express";
import { listConversionTypes, createConversionType, updateConversionType } from "../controllers/conversionTypeController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Everyone can view — a salesperson still needs the list to pick a type
// when recording a conversion. Adding/editing is admin & manager only.
router.get("/", listConversionTypes);
router.post("/", authorize("admin", "manager"), createConversionType);
router.put("/:id", authorize("admin", "manager"), updateConversionType);

export default router;
