import { Router } from "express";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
import Lead from "../models/Lead.js";
import Remark from "../models/Remark.js";
import Reminder from "../models/Reminder.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireElevated } from "../middleware/auth.js";
import { buildLeadFilter, canAccessLead } from "../utils/leadScope.js";
import { STAGES } from "../constants/index.js";
import { emitLeadEvent } from "../socket.js";

const router = Router();
router.use(requireAuth);

// ── LIST LEADS (privacy + slicer + month + search + stage filters) ──
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { slicer, month, search, stage, clientType } = req.query;
    const filter = buildLeadFilter(req.user, { slicer, month });

    if (stage && stage !== "all") filter.stage = stage;
    if (clientType && clientType !== "all") filter.clientType = clientType;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ siteName: re }, { contactPerson: re }, { location: re }, { contactNo: re }];
    }

    // The UI has no pagination yet (it loads the whole scoped list at once), so this
    // stays uncapped for realistic data volumes; 20000 is only a backstop against a
    // runaway import or a bug, not a real pagination limit.
    const leads = await Lead.find(filter).sort({ timestamp: -1 }).limit(20000).lean();
    res.json({ ok: true, data: leads });
  })
);

// ── AVAILABLE MONTHS FOR DROPDOWN ──
router.get(
  "/months",
  asyncHandler(async (req, res) => {
    const { slicer } = req.query;
    const filter = buildLeadFilter(req.user, { slicer });
    const leads = await Lead.find(filter).select("timestamp").lean();

    const seen = new Map();
    for (const l of leads) {
      if (!l.timestamp) continue;
      const d = new Date(l.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!seen.has(key)) {
        seen.set(key, d.toLocaleString("en-IN", { month: "long", year: "numeric" }));
      }
    }
    const months = [...seen.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([value, label]) => ({ value, label }));
    res.json({ ok: true, data: months });
  })
);

// ── SALESPERSONS (admin slicer dropdown) ──
router.get(
  "/salespersons",
  asyncHandler(async (req, res) => {
    const users = await User.find({ role: "sales" }).select("username frozen").lean();
    res.json({ ok: true, data: users.map((u) => ({ username: u.username, frozen: u.frozen })) });
  })
);

router.get("/stages", (req, res) => res.json({ ok: true, data: STAGES }));

// ── ADD LEAD ──
router.post(
  "/",
  [body("siteName").trim().notEmpty(), body("clientType").trim().notEmpty()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, msg: "Site name and client type are required." });

    if (req.user.role === "sales") {
      const me = await User.findById(req.user.id);
      if (me.frozen) return res.status(403).json({ ok: false, msg: "Account frozen. Cannot add leads." });
    }

    const d = req.body;
    const lead = await Lead.create({
      timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
      clientType: d.clientType,
      siteName: d.siteName,
      totalNo: d.totalNo || "",
      location: d.location || "",
      contactPerson: d.contactPerson || "",
      contactNo: d.contactNo || "",
      leadHead: ["admin", "manager"].includes(req.user.role) && d.leadHead ? d.leadHead : req.user.username,
      catalogue: d.catalogue || "",
      modeComm: d.modeComm || "",
      stage: d.stage || STAGES[0],
      remarks: d.remarks || "",
      email: d.email || "",
    });

    emitLeadEvent("lead:created", lead);
    res.status(201).json({ ok: true, data: lead });
  })
);

// ── BULK IMPORT (admin/manager only — old script had no gate; we scope leadHead assignment to admin/manager) ──
router.post(
  "/import",
  requireElevated,
  asyncHandler(async (req, res) => {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const docs = rows
      .filter((d) => d.siteName)
      .map((d) => ({
        timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
        clientType: d.clientType || "School",
        siteName: d.siteName,
        totalNo: d.totalNo || "",
        location: d.location || "",
        contactPerson: d.contactPerson || "",
        contactNo: d.contactNo || "",
        leadHead: d.leadHead || "",
        catalogue: d.catalogue || "",
        modeComm: d.modeComm || "",
        stage: d.stage || STAGES[0],
        remarks: d.remarks || "",
        email: d.email || "",
      }));

    if (!docs.length) return res.json({ ok: true, count: 0 });
    const created = await Lead.insertMany(docs);
    emitLeadEvent("lead:imported", { count: created.length });
    res.json({ ok: true, count: created.length });
  })
);

// ── QUICK UPDATE (stage + optional remark) ──
router.patch(
  "/:id/quick-update",
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ ok: false, msg: "Lead not found." });
    if (!canAccessLead(lead, req.user)) return res.status(403).json({ ok: false, msg: "Access denied. Not your lead." });

    const { stage, remark } = req.body;
    if (stage) lead.stage = stage;

    if (remark) {
      const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const fullText = `[${stamp}] ${req.user.username}: ${remark}`;
      lead.remarks = fullText;
      await Remark.create({ lead: lead._id, username: req.user.username, text: remark, fullText });
    }

    await lead.save();
    emitLeadEvent("lead:updated", lead);
    res.json({ ok: true, data: lead });
  })
);

// ── FULL EDIT (all fields; admin can reassign leadHead) ──
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ ok: false, msg: "Lead not found." });
    if (!canAccessLead(lead, req.user)) return res.status(403).json({ ok: false, msg: "Access denied. Not your lead." });

    const d = req.body;
    lead.clientType = d.clientType ?? lead.clientType;
    lead.siteName = d.siteName ?? lead.siteName;
    lead.totalNo = d.totalNo ?? lead.totalNo;
    lead.location = d.location ?? lead.location;
    lead.contactPerson = d.contactPerson ?? lead.contactPerson;
    lead.contactNo = d.contactNo ?? lead.contactNo;
    lead.catalogue = d.catalogue ?? lead.catalogue;
    lead.modeComm = d.modeComm ?? lead.modeComm;
    lead.stage = d.stage ?? lead.stage;
    lead.email = d.email ?? lead.email;
    if (["admin", "manager"].includes(req.user.role) && d.leadHead) lead.leadHead = d.leadHead;

    if (d.newRemark) {
      const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const fullText = `[${stamp}] ${req.user.username} (edited): ${d.newRemark}`;
      lead.remarks = fullText;
      await Remark.create({ lead: lead._id, username: req.user.username, text: d.newRemark, fullText, edited: true });
    }

    await lead.save();
    emitLeadEvent("lead:updated", lead);
    res.json({ ok: true, data: lead });
  })
);

// ── BULK DELETE (ownership validated per row for sales) ──
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ ok: false, msg: "No leads selected." });

    const leads = await Lead.find({ _id: { $in: ids } }).select("leadHead");
    for (const lead of leads) {
      if (!canAccessLead(lead, req.user)) {
        return res.status(403).json({ ok: false, msg: `Access denied. Lead ${lead._id} is not yours.` });
      }
    }

    await Lead.deleteMany({ _id: { $in: ids } });
    await Remark.deleteMany({ lead: { $in: ids } });
    await Reminder.deleteMany({ lead: { $in: ids } });

    emitLeadEvent("lead:deleted", { ids });
    res.json({ ok: true, msg: `Deleted ${leads.length} lead(s).` });
  })
);

// ── REMARKS HISTORY (newest first) ──
router.get(
  "/:id/remarks",
  asyncHandler(async (req, res) => {
    const remarks = await Remark.find({ lead: req.params.id }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, data: remarks });
  })
);

// ── REMINDERS: add + history ──
router.post(
  "/:id/reminders",
  [body("dateTime").notEmpty()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, msg: "Reminder date/time is required." });

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ ok: false, msg: "Lead not found." });
    if (!canAccessLead(lead, req.user)) return res.status(403).json({ ok: false, msg: "Access denied. Not your lead." });

    const reminder = await Reminder.create({
      lead: lead._id,
      siteName: lead.siteName,
      dateTime: new Date(req.body.dateTime),
      note: req.body.note || "",
      createdBy: req.user.username,
      status: "Pending",
    });

    res.status(201).json({ ok: true, data: reminder });
  })
);

router.get(
  "/:id/reminders",
  asyncHandler(async (req, res) => {
    const reminders = await Reminder.find({ lead: req.params.id }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, data: reminders });
  })
);

export default router;
