import bcrypt from "bcryptjs";
import { connectDB } from "../db.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// Seeds the same accounts (usernames/roles/emails) that existed in the old
// Google-Sheet CRM's Users tab, for continuity. Passwords are NOT carried
// over from the old sheet — that sheet stored them in plaintext, and baking
// real team members' real passwords into a source file that may end up in
// git history is its own leak. Every seeded account gets a random one-time
// password instead; whoever owns each account resets it on first login via
// the admin-only "change password" action.
const SEED_USERS = [
  { username: "Admin", role: "admin", email: "krrishredbean@gmail.com" },
  { username: "Rudra_Amit", role: "sales", email: "rudraredbeanhospitality@gmail.com" },
  { username: "Raj_Randhir", role: "sales", email: "iamrajsharma9306@gmail.com" },
  { username: "Vikasdeep_Rahul", role: "sales", email: "vikas.redbeanhospitality@gmail.com" },
  { username: "MDO_Leads", role: "sales", email: "redbeanhospitalitypc@gmail.com", email2: "info@redbeanhospitality.com" },
];

function randomPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-4).toUpperCase();
}

async function seed() {
  const { connected } = await connectDB();
  if (!connected) process.exit(1);

  const created = [];
  for (const u of SEED_USERS) {
    const existing = await User.findOne({ username: u.username });
    if (existing) {
      console.log(`[Seed] ${u.username} already exists, skipping.`);
      continue;
    }
    const tempPassword = randomPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await User.create({
      username: u.username,
      passwordHash,
      role: u.role,
      email: u.email || "",
      email2: u.email2 || "",
    });
    created.push({ username: u.username, tempPassword });
  }

  if (created.length) {
    console.log("\n[Seed] Created accounts — share these one-time passwords securely, then have each user change it:");
    for (const c of created) console.log(`  ${c.username}: ${c.tempPassword}`);
  }

  console.log("\n[Seed] Done.");
  await mongoose.disconnect();
  process.exit(0);
}

seed();
