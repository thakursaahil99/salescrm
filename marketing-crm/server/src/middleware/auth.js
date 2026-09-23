import jwt from "jsonwebtoken";
import { config } from "../config.js";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, msg: "Not authenticated." });

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.id).lean();
    if (!user) return res.status(401).json({ ok: false, msg: "User no longer exists." });
    if (user.frozen) return res.status(403).json({ ok: false, msg: "Account is frozen. Contact admin." });

    req.user = { id: String(user._id), username: user.username, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, msg: "Invalid or expired session." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ ok: false, msg: "Admin access required." });
  next();
}

// Manager has every admin capability except acting on the admin account itself
// (enforced route-by-route where a request targets another user). Used in
// place of requireAdmin wherever that distinction doesn't apply.
export function requireElevated(req, res, next) {
  if (!["admin", "manager"].includes(req.user?.role)) return res.status(403).json({ ok: false, msg: "Admin access required." });
  next();
}
