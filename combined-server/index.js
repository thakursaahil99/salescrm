import "dotenv/config";
import http from "http";
import express from "express";

import { createApp as createMarketingApp } from "../marketing-crm/server/src/app.js";
import { connectDB as connectMarketingDB } from "../marketing-crm/server/src/db.js";
import { assertConfig as assertMarketingConfig } from "../marketing-crm/server/src/assertConfig.js";
import { initSocket } from "../marketing-crm/server/src/socket.js";
import { startReminderJob } from "../marketing-crm/server/src/jobs/reminderJob.js";

import salesApp from "../sales-crm/backend/app.js";
import { connectDB as connectSalesDB, stopMemoryServer } from "../sales-crm/backend/config/db.js";
import { assertConfig as assertSalesConfig } from "../sales-crm/backend/config/assertConfig.js";
import { seedBase } from "../sales-crm/backend/seed/seedBase.js";
import { initRealtime, startReminderTicker } from "../sales-crm/backend/realtime/io.js";

// One process, one Render service, both CRMs. Each app is mounted whole
// under its own path prefix — /marketing and /sales — so their identically
// named routes (both define /api/auth, /api/leads, ...) land at different
// final URLs instead of colliding. Neither app's own source changed to make
// this work; this file just wires two already-complete apps together.
//
// A request to POST /marketing/api/auth/login reaches the Marketing CRM's
// own POST /api/auth/login handler unmodified — Express strips the mount
// prefix before handing the request to the sub-app.

try {
  assertMarketingConfig();
  assertSalesConfig();
} catch (err) {
  console.error("\n" + err.message + "\n");
  process.exit(1);
}

const { connected } = await connectMarketingDB();
if (!connected) process.exit(1);
await connectSalesDB();
await seedBase(); // idempotent — only creates the base 3 accounts on an empty DB

const root = express();
root.use("/marketing", createMarketingApp());
root.use("/sales", salesApp);
root.get("/", (req, res) => res.json({ ok: true, service: "admin-crm-combined-server" }));

const server = http.createServer(root);
// Distinct socket.io paths — two Server() instances on the same default
// path would otherwise fight over the same upgrade route.
initSocket(server, "/marketing/socket.io/"); // Marketing CRM's reminder job pushes live updates over this
const clientOrigins = (process.env.CLIENT_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
await initRealtime(server, clientOrigins, "/sales/socket.io/");
startReminderJob();
startReminderTicker();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`[Server] Combined Admin CRM API listening on port ${PORT}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await stopMemoryServer();
      process.exit(0);
    });
  });
}
