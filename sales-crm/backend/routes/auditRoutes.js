import express from "express";
import { listReversals, listMistakes } from "../controllers/auditController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect, authorize("admin", "manager"));

router.get("/reversals", listReversals);
router.get("/mistakes", listMistakes);

export default router;
