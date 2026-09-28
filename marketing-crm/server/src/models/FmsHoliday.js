import mongoose from "mongoose";

// Company holidays, shared by every FMS. Sundays are always off too (not stored here — see
// fmsSchedule.js) and cannot be turned off from the app.
const fmsHolidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // "YYYY-MM-DD", India calendar
    name: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

// Collection explicitly named "marketing_fmsholidays" — this app's DB now
// shares a single "crm" database with the Sales CRM.
export default mongoose.model("FmsHoliday", fmsHolidaySchema, "marketing_fmsholidays");
