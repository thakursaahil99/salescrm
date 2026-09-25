import FmsEntry from "../models/FmsEntry.js";

function badReq(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}
function tidy(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

// Picks the value for an entry's unique key: auto = next running number (retried a few times if two
// adds race for it); manual = the typed value, checked for length (uniqueness is enforced by the DB's
// own unique index).
export async function resolveUid(fms, typedValue) {
  if (!fms.uidAuto) {
    const v = tidy(typedValue);
    if (!v) throw badReq(`Enter ${fms.uidLabel}.`);
    if (v.length > 60) throw badReq(`${fms.uidLabel} is too long (max 60 characters).`);
    return { value: v, norm: v.toLowerCase() };
  }
  const top = await FmsEntry.find({ fmsId: fms._id }).select("uidValue").lean();
  let max = 0;
  for (const e of top) { const n = Number(e.uidValue); if (!isNaN(n) && n > max) max = n; }
  const value = String(max + 1);
  return { value, norm: value };
}

export function isDupKeyError(err) {
  return err && (err.code === 11000 || err.codeName === "DuplicateKey");
}

// Creates one FmsEntry under `fms`, retrying a fresh auto uid a few times if two adds race for the
// same running number. Shared by the "Add FMS Entry" route and anything that mirrors other data
// (e.g. a new Lead) into an FMS automatically.
export async function addFmsEntry(fms, { entryDate, assignedTo, fieldsSrc, createdBy }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const uid = await resolveUid(fms, fieldsSrc.uid);
    const fieldsObj = {};
    for (const f of fms.fields) fieldsObj[f.key] = String(fieldsSrc[f.key] ?? "");
    const steps = fms.steps.map((s) => ({ key: s.key, label: s.label, hours: s.hours, actual: null, remark: "", doneBy: "" }));
    try {
      return await FmsEntry.create({
        fmsId: fms._id, entryDate, assignedTo: tidy(assignedTo), fields: fieldsObj,
        uidValue: uid.value, uidNorm: uid.norm, steps, createdBy,
      });
    } catch (err) {
      if (isDupKeyError(err) && fms.uidAuto && attempt < 4) continue; // two adds raced for the same number: retry with a fresh one
      throw err;
    }
  }
}
