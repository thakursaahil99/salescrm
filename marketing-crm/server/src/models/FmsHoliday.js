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

export default mongoose.model("FmsHoliday", fmsHolidaySchema);
