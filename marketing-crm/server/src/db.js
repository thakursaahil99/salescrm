import dns from "dns";
import mongoose from "mongoose";
import { config } from "./config.js";

// On some dev machines Node's c-ares resolver ends up pointed at 127.0.0.1
// (no local DNS server listening there), which breaks the SRV lookup that
// `mongodb+srv://` URIs depend on even though the OS resolver works fine.
// Pointing Node at public resolvers directly sidesteps that.
if (dns.getServers().every((s) => s === "127.0.0.1")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

export async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
    console.log("[DB] Connected to MongoDB");
    return { connected: true };
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
    return { connected: false, error: err };
  }
}
