import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import Modal from "../../components/common/Modal.jsx";
import api from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";
import { hoursToHms, hmsToHours } from "./fmsUtils.jsx";

const FIELD_TYPES = [["text", "Text"], ["longtext", "Long text"], ["number", "Number"], ["date", "Date"], ["phone", "Phone"], ["email", "Email"]];

const emptyField = () => ({ label: "", type: "text" });
const emptyStep = () => ({ label: "", h: "", m: "", s: "" });

// Create a new FMS, or (fms set) rename it / relabel its form fields and steps. Fields and steps cannot
// be added or removed once the FMS exists; only a brand-new FMS can define them.
export default function FmsBuilderModal({ open, onClose, fms, onSaved, onDeleted }) {
  const editing = !!fms;
  const [name, setName] = useState("");
  const [uidLabel, setUidLabel] = useState("");
  const [uidMode, setUidMode] = useState("auto");
  const [fields, setFields] = useState([emptyField(), emptyField()]);
  const [steps, setSteps] = useState([emptyStep(), emptyStep(), emptyStep()]);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    if (fms) {
      setName(fms.name);
      setUidLabel(fms.uidLabel);
      setUidMode(fms.uidAuto ? "auto" : "manual");
      setFields(fms.fields.map((f) => ({ label: f.label, type: f.type })));
      setSteps(fms.steps.map((s) => ({ label: s.label, h: "", m: "", s: "" })));
    } else {
      setName("");
      setUidLabel("");
      setUidMode("auto");
      setFields([emptyField(), emptyField()]);
      setSteps([emptyStep(), emptyStep(), emptyStep()]);
    }
  }, [open, fms]);

  const setField = (i, patch) => setFields((list) => list.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const setStep = (i, patch) => setSteps((list) => list.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const addField = () => { if (fields.length >= 15) return push("An FMS can have at most 15 form fields.", "error"); setFields((l) => [...l, emptyField()]); };
  const addStep = () => { if (steps.length >= 12) return push("An FMS can have at most 12 steps.", "error"); setSteps((l) => [...l, emptyStep()]); };
  const removeField = (i) => setFields((l) => l.filter((_, k) => k !== i));
  const removeStep = (i) => setSteps((l) => l.filter((_, k) => k !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name,
      uid: { label: uidLabel, mode: uidMode },
      fields: fields.map((f) => ({ label: f.label, type: f.type })),
      steps: steps.map((s) => ({ label: s.label, hours: editing ? undefined : hmsToHours(s.h, s.m, s.s) })),
    };
    try {
      if (editing) {
        const res = await api.put(`/fms/${fms.id}`, payload);
        push("FMS updated.", "success");
        onSaved(res.data.data);
      } else {
        const res = await api.post("/fms", payload);
        push(`FMS "${res.data.data.name}" created.`, "success");
        onSaved(res.data.data);
      }
    } catch (err) {
      push(err.response?.data?.msg || "Failed to save the FMS.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove the FMS "${fms.name}"?\n\nIts entries will no longer show here. The data stays in the database.`)) return;
    try {
      await api.delete(`/fms/${fms.id}`);
      push("FMS removed.", "success");
      onDeleted(fms.id);
    } catch (err) {
      push(err.response?.data?.msg || "Failed to remove the FMS.", "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit "${fms.name}"` : "Create a new FMS"} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3">
          {editing
            ? "You can rename the FMS, its form fields and its steps here. Steps and fields cannot be added or removed once the FMS exists — create a new FMS for that. To change the timings, use Step Timings."
            : "An FMS is a process you track step by step (e.g. Purchase, Onboarding, Complaints). Give every entry a unique ID first, then the details to fill for every entry, then the steps and how long each may take. “Entry date & time” and “Assigned to” are added automatically."}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">FMS name *</label>
          <input className="input" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Purchase FMS" required />
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-1">1. Unique ID for every entry</h4>
          <p className="text-xs text-gray-500 mb-2">So the system (and your team) never mixes up two entries — every entry gets one, and no two can share it.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Name it *</label>
              <input className="input" maxLength={40} value={uidLabel} onChange={(e) => setUidLabel(e.target.value)} placeholder="e.g. Sr No, Order ID, Ticket No." required />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input type="radio" className="mt-0.5" name="uidmode" checked={uidMode === "auto"} disabled={editing} onChange={() => setUidMode("auto")} />
                <span>The app numbers entries itself (1, 2, 3, …) — nothing to type</span>
              </label>
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input type="radio" className="mt-0.5" name="uidmode" checked={uidMode === "manual"} disabled={editing} onChange={() => setUidMode("manual")} />
                <span>You type it for each entry — the app blocks a repeat</span>
              </label>
              {editing && <p className="text-[11px] text-gray-400">Cannot be changed once the FMS is created.</p>}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-1">2. Form details</h4>
          <p className="text-xs text-gray-500 mb-2">The details filled in for every entry. The first field is used as the title of each entry.</p>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input flex-1" maxLength={40} placeholder="Field name, e.g. Customer name" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} />
                <select className="input w-36" value={f.type} onChange={(e) => setField(i, { type: e.target.value })}>
                  {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {!editing && (
                  <button type="button" className="btn-icon text-red-500" title="Remove this field" onClick={() => removeField(i)}>
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!editing && (
            <button type="button" className="btn-secondary mt-2" onClick={addField}>
              <Plus size={15} /> Add field
            </button>
          )}
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-1">3. Steps and their timing</h4>
          {!editing && (
            <p className="text-xs text-gray-500 mb-2">
              Step 1 starts at the entry time. Every next step starts only when the step before it is marked done. The deadline is exactly the time you enter (Sundays and company holidays are not counted).
            </p>
          )}
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-50 text-brand flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                <input className="input flex-1" maxLength={60} placeholder="Step name, e.g. Site visit" value={s.label} onChange={(e) => setStep(i, { label: e.target.value })} />
                {!editing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="number" min="0" className="input w-16" placeholder="hr" value={s.h} onChange={(e) => setStep(i, { h: e.target.value })} />
                    <input type="number" min="0" className="input w-16" placeholder="min" value={s.m} onChange={(e) => setStep(i, { m: e.target.value })} />
                    <input type="number" min="0" className="input w-16" placeholder="sec" value={s.s} onChange={(e) => setStep(i, { s: e.target.value })} />
                  </div>
                )}
                {!editing && (
                  <button type="button" className="btn-icon text-red-500" title="Remove this step" onClick={() => removeStep(i)}>
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!editing && (
            <button type="button" className="btn-secondary mt-2" onClick={addStep}>
              <Plus size={15} /> Add step
            </button>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-100">
          {editing && !fms.isDefault ? (
            <button type="button" className="text-red-600 text-sm font-semibold hover:underline" onClick={handleDelete}>
              Remove this FMS
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : editing ? "Save changes" : "Create FMS"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
