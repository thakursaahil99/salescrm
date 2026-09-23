import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import leadRoutes from "./routes/leads.js";
import dashboardRoutes from "./routes/dashboard.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notifications.js";
import fmsRoutes from "./routes/fms.js";

export function createApp() {
  const app = express();

  // crossOriginResourcePolicy relaxed to "cross-origin": the Admin CRM shell (a different
  // origin/port) fetches this API directly for its SSO login handoff, and helmet's default
  // "same-origin" CORP silently blocks that at the browser level even when CORS allows it.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  // Allows both the app's own client and the Admin CRM shell (which calls
  // /auth/login directly from a different origin to fetch this CRM's token).
  // SHELL_URL is a separate env var (comma-separated for more than one) since the
  // shell is a different deployable app from this CRM's own client.
  const shellOrigins = (process.env.SHELL_URL || "http://localhost:7000").split(",").map((s) => s.trim());
  const allowedOrigins = [config.clientUrl, ...shellOrigins];
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(mongoSanitize());
  if (config.env !== "test") app.use(morgan("dev"));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
  app.use("/api", apiLimiter);

  // Stricter throttle on login specifically — the blanket limiter above (500/15min,
  // shared across every route) is far too loose to slow down credential stuffing
  // against one account, especially with the short passwords some accounts use.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, msg: "Too many login attempts. Please wait a few minutes and try again." },
  });
  app.use("/api/auth/login", loginLimiter);

  app.get("/api/health", (req, res) => res.json({ ok: true, service: "marketing-crm-server" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/leads", leadRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/fms", fmsRoutes);

  app.use((req, res) => res.status(404).json({ ok: false, msg: "Not found." }));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, msg: err.message || "Server error." });
  });

  return app;
}
