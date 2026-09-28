import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { chat } from "../controllers/assistantController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Tighter than the blanket /api limiter — each call hits a paid external API.
// Keyed per user so one chatty salesperson can't starve everyone else's quota.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Per logged-in user when we have one (always, behind `protect`); the IP
  // fallback goes through ipKeyGenerator so it normalizes IPv6 addresses
  // correctly instead of letting different addresses in the same /64 dodge
  // the limit.
  keyGenerator: (req) => (req.user?._id ? String(req.user._id) : ipKeyGenerator(req.ip)),
  message: { message: "Too many questions in a short time — wait a few minutes and try again." },
});

router.post("/chat", chatLimiter, chat);

export default router;
