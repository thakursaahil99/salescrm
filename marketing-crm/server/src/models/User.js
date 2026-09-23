import mongoose from "mongoose";
import { ROLES } from "../constants/index.js";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "sales" },
    email: { type: String, trim: true, default: "" },
    email2: { type: String, trim: true, default: "" },
    frozen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.methods.emails = function () {
  return [this.email, this.email2].filter(Boolean);
};

export default mongoose.model("User", userSchema);
