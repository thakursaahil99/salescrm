import mongoose from "mongoose";
import { REMINDER_STATUS } from "../constants/index.js";

const reminderSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    siteName: { type: String, trim: true, default: "" },
    dateTime: { type: Date, required: true },
    note: { type: String, trim: true, default: "" },
    createdBy: { type: String, required: true, trim: true },
    status: { type: String, enum: REMINDER_STATUS, default: "Pending" },
  },
  { timestamps: true }
);

reminderSchema.index({ status: 1, dateTime: 1 });
reminderSchema.index({ createdBy: 1, status: 1 });

export default mongoose.model("Reminder", reminderSchema);
