import http from "http";
import { config } from "./config.js";
import { connectDB } from "./db.js";
import { createApp } from "./app.js";
import { initSocket } from "./socket.js";
import { startReminderJob } from "./jobs/reminderJob.js";
import { assertConfig } from "./assertConfig.js";

async function main() {
  try {
    assertConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const { connected } = await connectDB();
  if (!connected) process.exit(1);

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`[Server] Marketing CRM API listening on http://localhost:${config.port}`);
  });

  startReminderJob();
}

main();
