import mongoose from "mongoose";

// One FMS = a process the admin builds in the app (e.g. Purchase, Onboarding, Complaints): a form
// (its own fields), and a fixed sequence of steps, each with a timing. Steps run one after another —
// step 1 starts at the entry date/time, every later step starts only when the step before it is marked
// done. Fields and steps cannot be added or removed once entries exist under them; only their labels
// (and a step's timing, via /timings) can change later.
const fieldSchema = new mongoose.Schema(
  { key: { type: String, required: true }, label: { type: String, required: true, trim: true }, type: { type: String, default: "text" } },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  { key: { type: String, required: true }, label: { type: String, required: true, trim: true }, hours: { type: Number, default: 0, min: 0 } },
  { _id: false }
);

const fmsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // The mandatory unique key every entry gets, so no two entries (and no two steps) are ever confused
    // with each other: either the app numbers entries itself (auto), or the admin types one per entry
    // and the app blocks a repeat (manual). Its mode never changes after creation; only its label can.
    uidLabel: { type: String, required: true, trim: true },
    uidAuto: { type: Boolean, default: true },
    assignedLabel: { type: String, default: "Assigned To" },
    fields: { type: [fieldSchema], validate: (v) => v.length >= 1 && v.length <= 15 },
    steps: { type: [stepSchema], validate: (v) => v.length >= 1 && v.length <= 12 },
    createdBy: { type: String, default: "" },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

fmsSchema.index({ name: 1 });
fmsSchema.index({ deleted: 1 });

// Collection explicitly named "marketing_fms" — this app's DB now shares a
// single "crm" database with the Sales CRM.
export default mongoose.model("Fms", fmsSchema, "marketing_fms");
