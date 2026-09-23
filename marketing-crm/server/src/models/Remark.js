import mongoose from "mongoose";

const remarkSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    username: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    fullText: { type: String, required: true, trim: true },
    edited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Remark", remarkSchema);
