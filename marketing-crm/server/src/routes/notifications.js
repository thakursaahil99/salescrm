import { Router } from "express";
import Reminder from "../models/Reminder.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Only the user who set the reminder sees it in their bell — polled by the client.
router.get(
  "/due",
  asyncHandler(async (req, res) => {
    const reminders = await Reminder.find({ status: "Sent", createdBy: req.user.username })
      .populate("lead", "siteName")
      .sort({ dateTime: -1 })
      .lean();
    res.json({ ok: true, data: reminders });
  })
);

router.patch(
  "/:id/notified",
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.username },
      { status: "Notified" },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ ok: false, msg: "Reminder not found." });
    res.json({ ok: true, data: reminder });
  })
);

export default router;
