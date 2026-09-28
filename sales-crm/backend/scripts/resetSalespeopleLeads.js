import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import User from "../models/User.js";
import Lead from "../models/Lead.js";
import Call from "../models/Call.js";
import Remark from "../models/Remark.js";
import Reminder from "../models/Reminder.js";
import IfoConversion from "../models/IfoConversion.js";
import EventBooking from "../models/EventBooking.js";
import Webinar from "../models/Webinar.js";
import Event from "../models/Event.js";

// Clears every current salesperson's leads before real handover — leads,
// calls, remarks, reminders, IFO conversions and event-seat bookings tied to
// them, plus their rows inside Webinar.registrations / Event.invitees
// (embedded subdocuments, so those are $pull'd rather than deleted).
//
// SAFE BY DEFAULT: prints what it would do and writes a full JSON backup, but
// only actually deletes when run with `--confirm`. Backup is written either
// way (skip with --no-backup once you've already got one you trust).
//
//   node scripts/resetSalespeopleLeads.js                 # dry run + backup
//   node scripts/resetSalespeopleLeads.js --confirm       # backup, then delete

const args = process.argv.slice(2);
const CONFIRM = args.includes("--confirm");
const SKIP_BACKUP = args.includes("--no-backup");

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set — refusing to run against an undefined database.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const conn = mongoose.connection;
  console.log(`[reset] Connected: ${conn.host}/${conn.name}`);

  const salespeople = await User.find({ role: "salesperson" }).select("name email").lean();
  const spIds = salespeople.map((u) => u._id);
  console.log(`[reset] ${salespeople.length} current salesperson(s): ${salespeople.map((u) => u.email).join(", ") || "(none)"}`);

  const leads = await Lead.find({ assignedTo: { $in: spIds } }).lean();
  const leadIds = leads.map((l) => l._id);
  console.log(`[reset] ${leads.length} lead(s) belong to them.`);

  if (!leadIds.length) {
    console.log("[reset] Nothing to do — no leads assigned to any current salesperson.");
    await mongoose.disconnect();
    return;
  }

  const [calls, remarks, reminders, conversions, bookings] = await Promise.all([
    Call.find({ lead: { $in: leadIds } }).lean(),
    Remark.find({ lead: { $in: leadIds } }).lean(),
    Reminder.find({ lead: { $in: leadIds } }).lean(),
    IfoConversion.find({ lead: { $in: leadIds } }).lean(),
    EventBooking.find({ lead: { $in: leadIds } }).lean(),
  ]);
  const leadIdSet = new Set(leadIds.map(String));
  const webinarsAffected = await Webinar.find({ "registrations.lead": { $in: leadIds } }).lean();
  const eventsAffected = await Event.find({ "invitees.lead": { $in: leadIds } }).lean();
  const registrationsHit = webinarsAffected.reduce(
    (n, w) => n + w.registrations.filter((r) => leadIdSet.has(String(r.lead))).length,
    0
  );
  const inviteesHit = eventsAffected.reduce(
    (n, e) => n + e.invitees.filter((i) => leadIdSet.has(String(i.lead))).length,
    0
  );

  console.log("[reset] Related records found:");
  console.log(`  Calls:              ${calls.length}`);
  console.log(`  Remarks:            ${remarks.length}`);
  console.log(`  Reminders:          ${reminders.length}`);
  console.log(`  IFO conversions:    ${conversions.length}`);
  console.log(`  Event-seat bookings:${bookings.length}`);
  console.log(`  Webinar registrations (rows inside ${webinarsAffected.length} webinar doc(s)): ${registrationsHit}`);
  console.log(`  Event invitees (rows inside ${eventsAffected.length} event doc(s)): ${inviteesHit}`);

  if (!SKIP_BACKUP) {
    const dir = path.resolve(process.cwd(), "backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `salespeople-leads-backup-${stamp}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          takenAt: new Date().toISOString(),
          salespeople,
          leads,
          calls,
          remarks,
          reminders,
          conversions,
          bookings,
          webinarRegistrations: webinarsAffected.map((w) => ({
            webinarId: w._id,
            title: w.title,
            registrations: w.registrations.filter((r) => leadIdSet.has(String(r.lead))),
          })),
          eventInvitees: eventsAffected.map((e) => ({
            eventId: e._id,
            title: e.title,
            invitees: e.invitees.filter((i) => leadIdSet.has(String(i.lead))),
          })),
        },
        null,
        2
      )
    );
    console.log(`[reset] Backup written: ${file}`);
  } else {
    console.log("[reset] --no-backup passed: skipped writing a backup.");
  }

  if (!CONFIRM) {
    console.log("\n[reset] DRY RUN ONLY — nothing was deleted. Re-run with --confirm to actually delete.");
    await mongoose.disconnect();
    return;
  }

  console.log("\n[reset] --confirm passed — deleting now...");
  const [rCalls, rRemarks, rReminders, rConv, rBookings] = await Promise.all([
    Call.deleteMany({ lead: { $in: leadIds } }),
    Remark.deleteMany({ lead: { $in: leadIds } }),
    Reminder.deleteMany({ lead: { $in: leadIds } }),
    IfoConversion.deleteMany({ lead: { $in: leadIds } }),
    EventBooking.deleteMany({ lead: { $in: leadIds } }),
  ]);
  const rWeb = await Webinar.updateMany({}, { $pull: { registrations: { lead: { $in: leadIds } } } });
  const rEvt = await Event.updateMany({}, { $pull: { invitees: { lead: { $in: leadIds } } } });
  const rLeads = await Lead.deleteMany({ _id: { $in: leadIds } });

  console.log("[reset] Deleted:");
  console.log(`  Leads:                 ${rLeads.deletedCount}`);
  console.log(`  Calls:                 ${rCalls.deletedCount}`);
  console.log(`  Remarks:               ${rRemarks.deletedCount}`);
  console.log(`  Reminders:             ${rReminders.deletedCount}`);
  console.log(`  IFO conversions:       ${rConv.deletedCount}`);
  console.log(`  Event-seat bookings:   ${rBookings.deletedCount}`);
  console.log(`  Webinars updated (registrations pulled): ${rWeb.modifiedCount}`);
  console.log(`  Events updated (invitees pulled):         ${rEvt.modifiedCount}`);
  console.log("\n[reset] Done.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[reset] FAILED:", err);
  process.exit(1);
});
