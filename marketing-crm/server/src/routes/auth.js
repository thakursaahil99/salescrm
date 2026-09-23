import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { config } from "../config.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function signToken(user) {
  return jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

router.post(
  "/login",
  [body("username").trim().notEmpty(), body("password").notEmpty()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, msg: "Username and password are required." });

    const { username, password } = req.body;
    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(401).json({ ok: false, msg: "Invalid username or password." });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ ok: false, msg: "Invalid username or password." });

    if (user.frozen) return res.status(403).json({ ok: false, msg: "Your account has been frozen. Contact admin." });

    const token = signToken(user);
    res.json({
      ok: true,
      token,
      user: { id: user._id, username: user.username, role: user.role, email: user.email },
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("username role email email2 frozen");
    res.json({ ok: true, user });
  })
);

export default router;
