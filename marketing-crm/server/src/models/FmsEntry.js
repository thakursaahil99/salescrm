import mongoose from "mongoose";

// One row of an FMS. `fields` holds the value of every form field of its FMS (key -> text), `steps` is a
// snapshot of that FMS's steps (label + timing) at creation time, each carrying its own Actual/remark.
// A step's PLANNED date and STATUS are never stored — they are always worked out fresh from entryDate,
// hours and the Actuals of the steps before it (see fmsSchedule.js), so a holiday added or removed today
// instantly and correctly changes the deadline of every entry, with nothing to "heal" afterwards.
const stepSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    hours: Number,
    actual: { type: Date, default: null },
    remark: { type: String, default: "" },
    doneBy: { type: String, default: "" },
  },
  { _id: false }
);

const fmsEntrySchema = new mongoose.Schema(
  {
    fmsId: { type: mongoose.Schema.Types.ObjectId, ref: "Fms", required: true, index: true },
    entryDate: { type: Date, required: true },
    assignedTo: { type: String, default: "", trim: true },
    fields: { type: Map, of: String, default: {} },
    uidValue: { type: String, required: true },
    // lower-cased/trimmed copy of uidValue; the unique index below is what actually stops two entries of
    // the same FMS ever sharing a unique key, even under two requests arriving at the same instant.
    uidNorm: { type: String, required: true },
    steps: { type: [stepSchema], default: [] },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

fmsEntrySchema.index({ fmsId: 1, uidNorm: 1 }, { unique: true });
fmsEntrySchema.index({ fmsId: 1, assignedTo: 1 });
fmsEntrySchema.index({ fmsId: 1, entryDate: -1 });

// Collection explicitly named "marketing_fmsentries" — this app's DB now
// shares a single "crm" database with the Sales CRM.
export default mongoose.model("FmsEntry", fmsEntrySchema, "marketing_fmsentries");
