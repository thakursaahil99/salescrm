import Reminder from "../models/Reminder.js";
import { emitToUser } from "../socket.js";

const FIVE_MINUTES = 5 * 60 * 1000;

// Replaces the old Apps Script time-driven trigger (checkAndSendReminders,
// every 5 min): flips due "Pending" reminders to "Sent" so the client's
// notification-bell poll (GET /api/notifications/due) picks them up, and
// pushes a live socket event to the owning user immediately.
async function checkAndSendReminders() {
  try {
    const due = await Reminder.find({ status: "Pending", dateTime: { $lte: new Date() } }).populate("lead", "siteName");
    for (const reminder of due) {
      reminder.status = "Sent";
      await reminder.save();
      emitToUser(reminder.createdBy, "reminder:due", {
        id: reminder._id,
        siteName: reminder.siteName,
        note: reminder.note,
        dateTime: reminder.dateTime,
      });
    }
  } catch (err) {
    console.error("[ReminderJob] check failed:", err.message);
  }
}

export function startReminderJob() {
  checkAndSendReminders();
  setInterval(checkAndSendReminders, FIVE_MINUTES);
}
