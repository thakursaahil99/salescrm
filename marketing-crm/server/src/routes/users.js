import { Router } from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireElevated } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireElevated);

// A manager has every admin capability in this file except acting on an
// admin account: they cannot change an admin's password, freeze an admin, or
// create a new admin account. Only a real admin can do those.
function blockedFromAdminTarget(req, target) {
  return target.role === "admin" && req.user.role !== "admin";
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await User.find().select("username role email email2 frozen createdAt").lean();
    res.json({ ok: true, data: users });
  })
);

router.post(
  "/",
  [body("username").trim().notEmpty(), body("password").isLength({ min: 4 })],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, msg: "Username and a password of at least 4 characters are required." });

    const { username, password, role, email, email2 } = req.body;
    if (role === "admin" && req.user.role !== "admin") return res.status(403).json({ ok: false, msg: "Only an admin can create another admin account." });
    const existing = await User.findOne({ username: username.trim() });
    if (existing) return res.status(409).json({ ok: false, msg: "Username already exists." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.trim(),
      passwordHash,
      role: ["admin", "manager"].includes(role) ? role : "sales",
      email: email || "",
      email2: email2 || "",
    });

    res.status(201).json({ ok: true, data: { id: user._id, username: user.username, role: user.role } });
  })
);

router.patch(
  "/:id/password",
  [body("password").isLength({ min: 4 })],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, msg: "Password must be at least 4 characters." });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, msg: "User not found." });
    if (blockedFromAdminTarget(req, user)) return res.status(403).json({ ok: false, msg: "Only an admin can change the admin's password." });

    user.passwordHash = await bcrypt.hash(req.body.password, 10);
    await user.save();
    res.json({ ok: true, msg: "Password updated." });
  })
);

router.patch(
  "/:id/freeze",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, msg: "User not found." });
    if (blockedFromAdminTarget(req, user)) return res.status(403).json({ ok: false, msg: "Only an admin can freeze the admin account." });

    user.frozen = !!req.body.freeze;
    await user.save();
    res.json({ ok: true, msg: `${user.username} ${user.frozen ? "frozen" : "unfrozen"}.` });
  })
);

export default router;
