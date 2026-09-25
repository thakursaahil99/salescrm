import { Router } from "express";
import mongoose from "mongoose";
import Fms from "../models/Fms.js";
import FmsEntry from "../models/FmsEntry.js";
import FmsHoliday from "../models/FmsHoliday.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireElevated } from "../middleware/auth.js";
import { buildFmsEntryFilter, canAccessFmsEntry } from "../utils/fmsScope.js";
import { isDupKeyError, addFmsEntry } from "../utils/fmsEntry.js";
import { computeChain, stepStatus, holidaySetFrom, parseHolidayDate, dateKeyFromMs, dayIndex, IST_MS, DAY_MS } from "../utils/fmsSchedule.js";

const router = Router();
router.use(requireAuth);

// ============================================================
// validation helpers (thrown errors are caught by asyncHandler -> the app's
// error middleware, which replies { ok:false, msg } with the given status)
// ============================================================
const FIELD_TYPES = ["text", "longtext", "number", "date", "phone", "email"];
const MAX_FIELDS = 15, MAX_STEPS = 12, MAX_HOURS = 8760, MAX_VALUE = 5000, REMARK_MIN = 3, REMARK_MAX = 500;

function badReq(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}
function tidy(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

async function checkName(name, exceptId) {
  const clean = tidy(name);
  if (!clean) throw badReq("Enter the FMS name.");
  if (clean.length > 50) throw badReq("The FMS name is too long (max 50 characters).");
  const clash = await Fms.findOne({ deleted: false, name: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).lean();
  if (clash) throw badReq(`There is already an FMS called "${clash.name}".`);
  return clean;
}
function checkUid(uid) {
  const label = tidy(uid?.label);
  if (!label) throw badReq('Enter a name for the unique ID (for example "Sr No" or "Order ID").');
  if (label.length > 40) throw badReq("The name of the unique ID is too long (max 40 characters).");
  return { label, auto: !uid || uid.mode !== "manual" };
}
function checkFields(list) {
  if (!Array.isArray(list) || !list.length) throw badReq("Add at least one form field (for example the customer's name).");
  if (list.length > MAX_FIELDS) throw badReq(`An FMS can have at most ${MAX_FIELDS} form fields.`);
  const seen = new Set();
  return list.map((f, i) => {
    const label = tidy(f?.label);
    if (!label) throw badReq(`Enter a name for form field ${i + 1}.`);
    if (label.length > 40) throw badReq(`The name of form field ${i + 1} is too long (max 40 characters).`);
    const norm = label.toLowerCase();
    if (seen.has(norm)) throw badReq(`Two form fields are called "${label}".`);
    seen.add(norm);
    return { label, type: FIELD_TYPES.includes(f?.type) ? f.type : "text" };
  });
}
function checkSteps(list, needHours) {
  if (!Array.isArray(list) || !list.length) throw badReq("Add at least one step.");
  if (list.length > MAX_STEPS) throw badReq(`An FMS can have at most ${MAX_STEPS} steps.`);
  return list.map((s, i) => {
    const label = tidy(s?.label);
    if (!label) throw badReq(`Enter a name for step ${i + 1}.`);
    if (label.length > 60) throw badReq(`The name of step ${i + 1} is too long (max 60 characters).`);
    let hours = Number(s?.hours);
    hours = isNaN(hours) || hours < 0 ? 0 : Math.round(hours * 3600) / 3600;
    if (needHours && !(hours > 0)) throw badReq(`Enter a timing for step ${i + 1} (${label}).`);
    if (hours > MAX_HOURS) throw badReq(`Step ${i + 1} (${label}) is too long: a step can take at most 1 year (${MAX_HOURS} hours).`);
    return { label, hours };
  });
}
function cleanRemark(v) {
  let s = String(v == null ? "" : v);
  s = Array.from(s).filter((ch) => { const c = ch.codePointAt(0); return c === 9 || c === 10 || c >= 32; }).join("");
  s = s.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (s.length < REMARK_MIN) throw badReq(`Please write a short remark (at least ${REMARK_MIN} characters) about this step.`);
  if (s.length > REMARK_MAX) throw badReq(`The remark is too long (max ${REMARK_MAX} characters).`);
  return s;
}
function checkFieldValues(fms, fieldsObj, assignedTo) {
  for (const f of fms.fields) {
    if (String(fieldsObj[f.key] ?? "").length > MAX_VALUE) throw badReq(`"${f.label}" is too long (max ${MAX_VALUE} characters).`);
  }
  if (tidy(assignedTo).length > 60) throw badReq(`The "${fms.assignedLabel || "Assigned To"}" name is too long (max 60 characters).`);
}

async function holidays() {
  const docs = await FmsHoliday.find().lean();
  return holidaySetFrom(docs);
}

function fmsOr404(fms) {
  if (!fms || fms.deleted) throw Object.assign(new Error("FMS not found."), { status: 404 });
  return fms;
}

// ============================================================
// FMS list / create / update / delete
// ============================================================
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const list = await Fms.find({ deleted: false }).sort({ createdAt: 1 }).lean();
    const counts = await FmsEntry.aggregate([{ $match: { fmsId: { $in: list.map((f) => f._id) } } }, { $group: { _id: { fmsId: "$fmsId", assignedTo: "$assignedTo" }, n: { $sum: 1 } } }]);
    const totalByFms = {}, mineByFms = {};
    for (const c of counts) {
      const id = String(c._id.fmsId);
      totalByFms[id] = (totalByFms[id] || 0) + c.n;
      if (c._id.assignedTo === req.user.username) mineByFms[id] = (mineByFms[id] || 0) + c.n;
    }
    const data = list.map((f) => ({
      id: String(f._id), name: f.name, uidLabel: f.uidLabel, uidAuto: f.uidAuto, assignedLabel: f.assignedLabel,
      fields: f.fields, steps: f.steps,
      count: ["admin", "manager"].includes(req.user.role) ? totalByFms[String(f._id)] || 0 : mineByFms[String(f._id)] || 0,
    }));
    res.json({ ok: true, data });
  })
);

router.post(
  "/",
  requireElevated,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const name = await checkName(b.name);
    const uid = checkUid(b.uid);
    const fields = checkFields(b.fields).map((f, i) => ({ ...f, key: `f${i + 1}` }));
    const steps = checkSteps(b.steps, true).map((s, i) => ({ ...s, key: `s${i + 1}` }));
    const fms = await Fms.create({ name, uidLabel: uid.label, uidAuto: uid.auto, fields, steps, createdBy: req.user.username });
    res.status(201).json({ ok: true, data: { id: String(fms._id), name: fms.name, uidLabel: fms.uidLabel, uidAuto: fms.uidAuto, assignedLabel: fms.assignedLabel, fields: fms.fields, steps: fms.steps, count: 0 } });
  })
);

// Rename the FMS, its unique-ID label, its form field labels/types and its step labels. Fields and steps
// cannot be added or removed here (entries already sit in those slots) — create a new FMS for that.
router.put(
  "/:id",
  requireElevated,
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    const b = req.body || {};
    if (!Array.isArray(b.fields) || b.fields.length !== fms.fields.length || !Array.isArray(b.steps) || b.steps.length !== fms.steps.length)
      throw badReq("Steps and form fields cannot be added or removed after the FMS is created. Create a new FMS for that.");
    const name = await checkName(b.name, fms._id);
    const uidLabel = tidy(b.uid?.label);
    if (!uidLabel) throw badReq("Enter a name for the unique ID.");
    if (uidLabel.length > 40) throw badReq("The name of the unique ID is too long (max 40 characters).");
    const fields = checkFields(b.fields);
    const steps = checkSteps(b.steps, false);
    fms.name = name;
    fms.uidLabel = uidLabel; // mode (auto/manual) never changes
    fms.fields = fms.fields.map((f, i) => ({ ...f.toObject(), label: fields[i].label, type: fields[i].type }));
    fms.steps = fms.steps.map((s, i) => ({ ...s.toObject(), label: steps[i].label }));
    await fms.save();
    // keep every entry's step LABELS in step with the FMS (the timing/actual/remark are per-entry data)
    await FmsEntry.updateMany({ fmsId: fms._id }, { $set: Object.fromEntries(fms.steps.map((s, i) => [`steps.${i}.label`, s.label])) });
    res.json({ ok: true, data: { id: String(fms._id), name: fms.name, uidLabel: fms.uidLabel, uidAuto: fms.uidAuto, assignedLabel: fms.assignedLabel, fields: fms.fields, steps: fms.steps } });
  })
);

router.delete(
  "/:id",
  requireElevated,
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    fms.deleted = true;
    await fms.save();
    res.json({ ok: true, msg: `"${fms.name}" removed. Its entries are kept (hidden), not deleted.` });
  })
);

// Saves the step hours of an FMS. applyToExisting also rewrites the Hours snapshot on entries already
// there (their Planned dates follow at once, since Planned is always computed, never stored).
router.put(
  "/:id/timings",
  requireElevated,
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    const b = req.body || {};
    if (!Array.isArray(b.hours) || b.hours.length !== fms.steps.length) throw badReq("Nothing to save.");
    const hours = b.hours.map((v, i) => {
      let h = Number(v);
      h = isNaN(h) || h < 0 ? 0 : Math.round(h * 3600) / 3600;
      if (h > MAX_HOURS) throw badReq(`Step ${i + 1} (${fms.steps[i].label}) is too long: a step can take at most 1 year (${MAX_HOURS} hours).`);
      return h;
    });
    fms.steps = fms.steps.map((s, i) => ({ ...s.toObject(), hours: hours[i] }));
    await fms.save();
    let updated = 0;
    if (b.applyToExisting) {
      const res2 = await FmsEntry.updateMany({ fmsId: fms._id }, { $set: Object.fromEntries(hours.map((h, i) => [`steps.${i}.hours`, h])) });
      updated = res2.modifiedCount || 0;
    }
    res.json({ ok: true, data: "Timings saved.", updated });
  })
);

router.get(
  "/:id/timings",
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    res.json({ ok: true, data: { labels: fms.steps.map((s) => s.label), hours: fms.steps.map((s) => s.hours) } });
  })
);

// ============================================================
// company holidays (shared by every FMS; Sunday is always off, not stored)
// ============================================================
router.get(
  "/holidays",
  asyncHandler(async (req, res) => {
    const list = await FmsHoliday.find().sort({ date: 1 }).lean();
    res.json({ ok: true, data: { list: list.map((h) => ({ date: h.date, name: h.name })), weeklyOff: [0] } });
  })
);

router.post(
  "/holidays",
  requireElevated,
  asyncHandler(async (req, res) => {
    const { from, to, name } = req.body || {};
    const a = parseHolidayDate(from);
    if (!a) throw badReq("Pick the holiday date.");
    const b = to ? parseHolidayDate(to) : a;
    if (!b) throw badReq('The "to" date is not a valid date.');
    if (b.day < a.day) throw badReq('The "to" date cannot be before the "from" date.');
    if (b.day - a.day > 59) throw badReq("Add at most 60 days at a time.");
    const cleanName = tidy(name);
    if (cleanName.length > 60) throw badReq("The holiday name is too long (max 60 characters).");
    const existing = new Set((await FmsHoliday.find().select("date").lean()).map((h) => h.date));
    let added = 0;
    for (let day = a.day; day <= b.day; day++) {
      const t = new Date(day * DAY_MS);
      const p = (n) => String(n).padStart(2, "0");
      const key = `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
      if (existing.has(key)) continue;
      await FmsHoliday.create({ date: key, name: cleanName });
      existing.add(key);
      added++;
    }
    const list = await FmsHoliday.find().sort({ date: 1 }).lean();
    res.json({ ok: true, data: { added, list: list.map((h) => ({ date: h.date, name: h.name })) } });
  })
);

router.delete(
  "/holidays/:date",
  requireElevated,
  asyncHandler(async (req, res) => {
    const parsed = parseHolidayDate(req.params.date);
    if (!parsed) throw badReq("Invalid date.");
    const removed = await FmsHoliday.findOneAndDelete({ date: parsed.key });
    if (!removed) throw badReq("That date is not in the holiday list.");
    const list = await FmsHoliday.find().sort({ date: 1 }).lean();
    res.json({ ok: true, data: { list: list.map((h) => ({ date: h.date, name: h.name })) } });
  })
);

// ============================================================
// entries
// ============================================================
function serializeEntry(entry, fms, holidayDays) {
  const hoursArr = entry.steps.map((s) => s.hours);
  const actualsMs = entry.steps.map((s) => (s.actual ? new Date(s.actual).getTime() : null));
  const plannedMs = computeChain(new Date(entry.entryDate).getTime(), hoursArr, actualsMs, holidayDays);
  const now = Date.now();
  let lastRemark = null;
  const steps = entry.steps.map((s, i) => {
    const waiting = i > 0 && !actualsMs[i - 1] && (Number(s.hours) || 0) > 0;
    const status = stepStatus(plannedMs[i], actualsMs[i], waiting, now);
    if (actualsMs[i] && s.remark) lastRemark = { step: s.label, text: s.remark, by: s.doneBy, at: actualsMs[i] };
    return { key: s.key, label: s.label, hours: s.hours, plannedTs: plannedMs[i] || 0, actualTs: actualsMs[i] || 0, status, remark: s.remark || "", doneBy: s.doneBy || "" };
  });
  const fieldsObj = entry.fields instanceof Map ? Object.fromEntries(entry.fields) : { ...(entry.fields || {}) };
  const titleKey = fms.fields[0]?.key, subKey = fms.fields[1]?.key;
  let title = fieldsObj[titleKey] || "", sub = fieldsObj[subKey] || "";
  if (!title) { title = sub || entry.uidValue || "(no title)"; if (title === sub) sub = ""; }
  return {
    id: String(entry._id), fmsId: String(entry.fmsId), entryDate: entry.entryDate, entryTs: new Date(entry.entryDate).getTime(),
    assignedTo: entry.assignedTo || "", fields: fieldsObj, uid: entry.uidValue,
    title, sub, steps, lastRemark, createdAt: entry.createdAt,
  };
}

router.get(
  "/:id/entries",
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id).lean());
    const filter = buildFmsEntryFilter(req.user, { fmsId: fms._id });
    const entries = await FmsEntry.find(filter).sort({ entryDate: -1 }).limit(20000).lean();
    const hol = await holidays();
    res.json({ ok: true, serverNow: Date.now(), fmsId: String(fms._id), data: entries.map((e) => serializeEntry(e, fms, hol)) });
  })
);

router.post(
  "/:id/entries",
  requireElevated,
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    const b = req.body || {};
    const entryDate = new Date(b.entryDate);
    if (!b.entryDate || isNaN(entryDate.getTime())) throw badReq("Entry date/time is required.");
    const fieldsSrc = b.fields && typeof b.fields === "object" ? b.fields : {};
    checkFieldValues(fms, fieldsSrc, b.assignedTo);

    let entry;
    try {
      entry = await addFmsEntry(fms, { entryDate, assignedTo: b.assignedTo, fieldsSrc, createdBy: req.user.username });
    } catch (err) {
      if (isDupKeyError(err)) throw badReq(`"${fieldsSrc.uid}" is already used for ${fms.uidLabel}. Each entry needs its own ${fms.uidLabel}.`);
      throw err;
    }
    const hol = await holidays();
    res.status(201).json({ ok: true, data: serializeEntry(entry.toObject(), fms, hol) });
  })
);

router.put(
  "/:id/entries/:entryId",
  requireElevated,
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    const entry = await FmsEntry.findOne({ _id: req.params.entryId, fmsId: fms._id });
    if (!entry) throw Object.assign(new Error("FMS entry not found."), { status: 404 });
    const b = req.body || {};
    const entryDate = new Date(b.entryDate);
    if (!b.entryDate || isNaN(entryDate.getTime())) throw badReq("Entry date/time is required.");
    const fieldsSrc = b.fields && typeof b.fields === "object" ? b.fields : {};
    checkFieldValues(fms, fieldsSrc, b.assignedTo);

    if (!fms.uidAuto) {
      const v = tidy(fieldsSrc.uid);
      if (!v) throw badReq(`Enter ${fms.uidLabel}.`);
      if (v.length > 60) throw badReq(`${fms.uidLabel} is too long (max 60 characters).`);
      entry.uidValue = v;
      entry.uidNorm = v.toLowerCase();
    } // auto: never changes, whatever the page sends

    entry.entryDate = entryDate;
    entry.assignedTo = tidy(b.assignedTo);
    const fieldsObj = {};
    for (const f of fms.fields) fieldsObj[f.key] = String(fieldsSrc[f.key] ?? "");
    entry.fields = fieldsObj;
    try {
      await entry.save();
    } catch (err) {
      if (isDupKeyError(err)) throw badReq(`"${fieldsSrc.uid}" is already used for ${fms.uidLabel}. Each entry needs its own ${fms.uidLabel}.`);
      throw err;
    }
    const hol = await holidays();
    res.json({ ok: true, data: serializeEntry(entry.toObject(), fms, hol) });
  })
);

router.delete(
  "/:id/entries/:entryId",
  requireElevated,
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    const removed = await FmsEntry.findOneAndDelete({ _id: req.params.entryId, fmsId: fms._id });
    if (!removed) throw Object.assign(new Error("FMS entry not found."), { status: 404 });
    res.json({ ok: true, msg: "FMS entry deleted." });
  })
);

// The steps go in order: a step can be marked done only after the step before it is done, and marking it
// starts the timer of the next step. EVERY step needs a remark, from admin and sales alike.
router.post(
  "/:id/entries/:entryId/steps/:idx/done",
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    const idx = Number(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= fms.steps.length) throw badReq("Invalid step.");
    const entry = await FmsEntry.findOne({ _id: req.params.entryId, fmsId: fms._id });
    if (!entry) throw Object.assign(new Error("FMS entry not found."), { status: 404 });
    if (!canAccessFmsEntry(entry, req.user)) throw Object.assign(new Error("This lead is not assigned to you."), { status: 403 });

    const isAdmin = ["admin", "manager"].includes(req.user.role);
    const step = entry.steps[idx];
    if (!isAdmin && !(Number(step.hours) > 0)) throw badReq("This step has no timing set.");
    if (step.actual) throw badReq("This step is already marked done.");
    if (idx > 0 && !entry.steps[idx - 1].actual) throw badReq(`Mark "${fms.steps[idx - 1].label}" done first. A step starts only when the step before it is done.`);

    const text = cleanRemark(req.body?.remark);
    let val = new Date();
    if (isAdmin && req.body?.actualDate) {
      val = new Date(req.body.actualDate);
      if (isNaN(val.getTime())) throw badReq("Invalid date/time.");
      const start = idx === 0 ? entry.entryDate : entry.steps[idx - 1].actual;
      if (start && Math.floor(val.getTime() / 60000) < Math.floor(new Date(start).getTime() / 60000))
        throw badReq(`The finish time cannot be before this step started (${new Date(start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}).`);
    }
    entry.steps[idx].actual = val;
    entry.steps[idx].remark = text;
    entry.steps[idx].doneBy = req.user.username;
    await entry.save();
    const hol = await holidays();
    res.json({ ok: true, data: serializeEntry(entry.toObject(), fms, hol) });
  })
);

// Admin only (undo a "mark done" made by mistake). Only the latest finished step can be reopened, because
// the steps after it were counted from its finish time.
router.post(
  "/:id/entries/:entryId/steps/:idx/reopen",
  requireElevated,
  asyncHandler(async (req, res) => {
    const fms = fmsOr404(await Fms.findById(req.params.id));
    const idx = Number(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= fms.steps.length) throw badReq("Invalid step.");
    const entry = await FmsEntry.findOne({ _id: req.params.entryId, fmsId: fms._id });
    if (!entry) throw Object.assign(new Error("FMS entry not found."), { status: 404 });
    for (let k = idx + 1; k < entry.steps.length; k++) if (entry.steps[k].actual) throw badReq(`Reopen "${fms.steps[k].label}" first. It was started after this step.`);
    entry.steps[idx].actual = null;
    entry.steps[idx].remark = "";
    entry.steps[idx].doneBy = "";
    await entry.save();
    const hol = await holidays();
    res.json({ ok: true, data: serializeEntry(entry.toObject(), fms, hol) });
  })
);

// ============================================================
// analytics (admin)
// ============================================================
const SEVERITY = [
  { label: "Under 1 hour", max: 3600 },
  { label: "1 - 6 hours", max: 6 * 3600 },
  { label: "6 - 24 hours", max: 24 * 3600 },
  { label: "Over 1 day", max: Infinity },
];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function sevIndex(sec) {
  for (let i = 0; i < SEVERITY.length; i++) if (sec < SEVERITY[i].max) return i;
  return SEVERITY.length - 1;
}
function weekStart(ts) {
  const d = new Date(ts + IST_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
}
function weekLabel(key) {
  const d = new Date(key);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}
function rate(onTime, judged) {
  return judged > 0 ? Math.round((onTime / judged) * 10000) / 10000 : null;
}

router.get(
  "/analytics",
  requireElevated,
  asyncHandler(async (req, res) => {
    const person = tidy(req.query.person), days = Number(req.query.days) || 0, pick = tidy(req.query.fmsId);
    const allDefs = await Fms.find({ deleted: false }).sort({ createdAt: 1 }).lean();
    let wanted = allDefs;
    if (pick && pick !== "__all") {
      wanted = allDefs.filter((d) => String(d._id) === pick);
      if (!wanted.length) throw Object.assign(new Error("FMS not found."), { status: 404 });
    }
    const single = wanted.length === 1;
    const hol = await holidays();
    const users = await User.find().select("username role").lean();

    const problems = [];
    const perFms = new Map();
    let all = [];
    for (const def of wanted) {
      try {
        const entries = await FmsEntry.find({ fmsId: def._id }).lean();
        all.push(...entries.map((e) => ({ ...serializeEntry(e, def, hol), fmsId: String(def._id), fmsName: def.name })));
      } catch (err) {
        problems.push({ id: String(def._id), name: def.name, error: err.message });
      }
    }

    const peopleSeen = new Set(), people = [];
    let hasUnassigned = false;
    for (const u of users) if (u.role === "sales") { peopleSeen.add(u.username.toLowerCase()); people.push(u.username); }
    for (const e of all) {
      const k = (e.assignedTo || "").toLowerCase();
      if (!k) { hasUnassigned = true; continue; }
      if (!peopleSeen.has(k)) { peopleSeen.add(k); people.push(e.assignedTo); }
    }
    people.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));

    const now = Date.now();
    const entries = all.filter((e) => {
      if (days && e.entryTs < now - days * DAY_MS) return false;
      if (person === "__none") return !e.assignedTo;
      if (person) return e.assignedTo.toLowerCase() === person.toLowerCase();
      return true;
    });

    const kpi = { totalEntries: entries.length, inProgress: 0, completed: 0, noTimings: 0, overdueSteps: 0, overdueEntries: 0, dueSoon24: 0, onTimeSteps: 0, lateSteps: 0, pendingSteps: 0, judgedSteps: 0 };
    for (const def of wanted) perFms.set(String(def._id), {
      id: String(def._id), name: def.name,
      kpi: { entries: 0, inProgress: 0, completed: 0, noTimings: 0, onTimeSteps: 0, lateSteps: 0, overdueSteps: 0, pendingSteps: 0 },
      stepAgg: def.steps.map((s) => ({ label: s.label, onTime: 0, late: 0, overdue: 0, pending: 0, lateSec: 0 })),
      pipeline: def.steps.map((s) => ({ label: s.label, onTrack: 0, overdue: 0 })),
    });
    const sev = SEVERITY.map((x) => ({ label: x.label, late: 0, overdue: 0 }));
    const teamMap = new Map();
    let lateSecTotal = 0, lateCount = 0;
    const overdueList = [], dueSoon = [], recentLate = [];

    function teamRow(rawName) {
      const k = (rawName || "").toLowerCase() || "__none";
      if (!teamMap.has(k)) {
        const u = users.find((x) => x.username.toLowerCase() === (rawName || "").toLowerCase());
        teamMap.set(k, { key: k, name: u ? u.username : rawName || "(unassigned)", hasLogin: !!u, unassigned: !rawName, entries: 0, onTime: 0, late: 0, overdue: 0, pending: 0, lateSec: 0 });
      }
      return teamMap.get(k);
    }
    if (!person) for (const u of users) if (u.role === "sales") teamRow(u.username);

    const weekKeys = [], weekly = {}, thisWeek = weekStart(now);
    for (let w = 7; w >= 0; w--) { const wk = thisWeek - w * 7 * DAY_MS; weekKeys.push(wk); weekly[wk] = { label: weekLabel(wk), onTime: 0, late: 0 }; }

    for (const e of entries) {
      const t = teamRow(e.assignedTo), pd = perFms.get(e.fmsId);
      t.entries++; pd.kpi.entries++;
      let anySet = false, allDone = true, current = -1, entryOverdue = false;
      e.steps.forEach((st, i) => {
        if (!st.plannedTs) return;
        anySet = true;
        const agg = pd.stepAgg[i];
        const item = { id: e.id, fms: e.fmsName, name: e.title, companyName: e.sub, step: st.label, assignedTo: e.assignedTo, plannedTs: st.plannedTs, actualTs: st.actualTs, remark: st.remark, doneBy: st.doneBy };
        if (st.status === "done_on_time") {
          agg.onTime++; t.onTime++; kpi.onTimeSteps++; pd.kpi.onTimeSteps++;
          const wko = weekStart(st.actualTs); if (weekly[wko]) weekly[wko].onTime++;
        } else if (st.status === "done_late") {
          const lateSec = (st.actualTs - st.plannedTs) / 1000;
          agg.late++; agg.lateSec += lateSec; t.late++; t.lateSec += lateSec; kpi.lateSteps++; pd.kpi.lateSteps++;
          lateSecTotal += lateSec; lateCount++;
          sev[sevIndex(lateSec)].late++;
          const wkl = weekStart(st.actualTs); if (weekly[wkl]) weekly[wkl].late++;
          item.lateSec = lateSec; recentLate.push(item);
        } else if (st.status === "overdue") {
          const overSec = (now - st.plannedTs) / 1000;
          agg.overdue++; t.overdue++; kpi.overdueSteps++; pd.kpi.overdueSteps++; entryOverdue = true;
          sev[sevIndex(overSec)].overdue++;
          item.overdueSec = overSec; overdueList.push(item);
        } else if (st.status === "pending") {
          agg.pending++; t.pending++; kpi.pendingSteps++; pd.kpi.pendingSteps++;
          if (st.plannedTs - now <= DAY_MS) { kpi.dueSoon24++; dueSoon.push(item); }
        }
        if (st.status === "overdue" || st.status === "pending") { allDone = false; if (current < 0) current = i; }
      });
      if (!anySet) { kpi.noTimings++; pd.kpi.noTimings++; }
      else if (allDone) { kpi.completed++; pd.kpi.completed++; }
      else {
        kpi.inProgress++; pd.kpi.inProgress++;
        if (e.steps[current].status === "overdue") pd.pipeline[current].overdue++; else pd.pipeline[current].onTrack++;
      }
      if (entryOverdue) kpi.overdueEntries++;
    }

    kpi.judgedSteps = kpi.onTimeSteps + kpi.lateSteps + kpi.overdueSteps;
    kpi.onTimeRate = rate(kpi.onTimeSteps, kpi.judgedSteps);
    kpi.avgLateSec = lateCount ? Math.round(lateSecTotal / lateCount) : null;

    const breakdown = wanted.map((def) => {
      const pd = perFms.get(String(def._id)), k = pd.kpi;
      k.judgedSteps = k.onTimeSteps + k.lateSteps + k.overdueSteps;
      k.onTimeRate = rate(k.onTimeSteps, k.judgedSteps);
      return { id: pd.id, name: pd.name, kpi: k, pipeline: pd.pipeline, stepHealth: pd.stepAgg.map((a) => { const judged = a.onTime + a.late + a.overdue; return { label: a.label, onTime: a.onTime, late: a.late, overdue: a.overdue, pending: a.pending, rate: rate(a.onTime, judged), avgLateSec: a.late ? Math.round(a.lateSec / a.late) : null }; }) };
    });

    const team = [...teamMap.values()].map((t) => { const judged = t.onTime + t.late + t.overdue; return { name: t.name, hasLogin: t.hasLogin, unassigned: t.unassigned, entries: t.entries, done: t.onTime + t.late, onTime: t.onTime, late: t.late, overdue: t.overdue, pending: t.pending, rate: rate(t.onTime, judged), avgLateSec: t.late ? Math.round(t.lateSec / t.late) : null }; });
    team.sort((a, b) => b.overdue - a.overdue || b.entries - a.entries || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));

    overdueList.sort((a, b) => b.overdueSec - a.overdueSec);
    dueSoon.sort((a, b) => a.plannedTs - b.plannedTs);
    recentLate.sort((a, b) => b.actualTs - a.actualTs);

    res.json({
      ok: true, serverNow: now, scope: single ? "one" : "all", filter: { person, days, fmsId: single ? wanted[0]?._id?.toString() : "__all" },
      people, hasUnassigned, kpi,
      pipeline: single ? breakdown[0]?.pipeline || null : null, stepHealth: single ? breakdown[0]?.stepHealth || null : null,
      breakdown, problems, mix: { onTime: kpi.onTimeSteps, late: kpi.lateSteps, overdue: kpi.overdueSteps, pending: kpi.pendingSteps },
      severity: sev, team, weekly: weekKeys.map((k) => weekly[k]),
      overdueList: overdueList.slice(0, 15), dueSoon: dueSoon.slice(0, 15), recentLate: recentLate.slice(0, 10),
    });
  })
);

export default router;
