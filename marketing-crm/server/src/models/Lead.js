import mongoose from "mongoose";
import { STAGES, CLIENT_TYPES } from "../constants/index.js";

const leadSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    clientType: { type: String, enum: CLIENT_TYPES, required: true },
    siteName: { type: String, required: true, trim: true },
    totalNo: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    contactPerson: { type: String, trim: true, default: "" },
    contactNo: { type: String, trim: true, default: "" },
    leadHead: { type: String, required: true, trim: true },
    catalogue: { type: String, trim: true, default: "" },
    modeComm: { type: String, trim: true, default: "" },
    stage: { type: String, enum: STAGES, default: STAGES[0] },
    remarks: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

leadSchema.index({ leadHead: 1 });
leadSchema.index({ timestamp: -1 });
leadSchema.index({ stage: 1 });
leadSchema.index({ siteName: "text", contactPerson: "text", location: "text" });

// Collection explicitly named "marketing_leads" — this app's DB now shares
// a single "crm" database with the Sales CRM, which has its own unrelated
// "leads" collection (its sales pipeline, not marketing outreach).
export default mongoose.model("Lead", leadSchema, "marketing_leads");
