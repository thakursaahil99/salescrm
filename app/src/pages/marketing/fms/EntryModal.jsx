import { useEffect, useState } from "react";
import Modal from "../../../marketing-lib/Modal.jsx";
import api from "../../../services/marketingApi.js";
import { useToast } from "../../../marketing-lib/useToast.js";
import { toInputDT } from "./fmsUtils.jsx";

const INPUT_TYPE = { number: "number", date: "date", phone: "tel", email: "email" };

// Add (entry=null) or edit an entry of one FMS. Its form is built from that FMS's own fields.
export default function EntryModal({ open, onClose, fms, entry, salespersons, onSaved }) {
  const editing = !!entry;
  const [entryDate, setEntryDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!open || !fms) return;
    if (entry) {
      setEntryDate(toInputDT(entry.entryTs));
      setAssignedTo(entry.assignedTo || "");
      setFields({ ...entry.fields });
    } else {
      setEntryDate(toInputDT(Date.now()));
      setAssignedTo("");
      const blank = {};
      for (const f of fms.fields) blank[f.key] = "";
      if (!fms.uidAuto) blank.uid = "";
      setFields(blank);
    }
  }, [open, fms, entry]);

  if (!fms) return null;
  const setField = (key, v) => setFields((f) => ({ ...f, [key]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!entryDate) return push("Entry date/time is required.", "error");
    setSaving(true);
    const payload = { entryDate, assignedTo, fields };
    try {
      if (editing) {
        const res = await api.put(`/fms/${fms.id}/entries/${entry.id}`, payload);
        push("FMS entry updated.", "success");
        onSaved(res.data.data);
      } else {
        const res = await api.post(`/fms/${fms.id}/entries`, payload);
        push("FMS entry added.", "success");
        onSaved(res.data.data);
      }
    } catch (err) {
      push(err.response?.data?.msg || "Failed to save the entry.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${fms.name} Entry` : `Add ${fms.name} Entry`} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Entry Date &amp; Time *</label>
            <input type="datetime-local" className="input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
          </div>

          {!fms.uidAuto && (
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">{fms.uidLabel} *</label>
              <input className="input" value={fields.uid || ""} onChange={(e) => setField("uid", e.target.value)} required />
              <p className="text-[11px] text-gray-400 mt-1">Must be unique — no two entries can share it.</p>
            </div>
          )}
          {fms.uidAuto && editing && (
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">{fms.uidLabel}</label>
              <input className="input bg-gray-50" value={entry.uid} disabled />
            </div>
          )}

          {fms.fields.map((f) => (
            <div key={f.key} className={f.type === "longtext" ? "sm:col-span-2" : ""}>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">{f.label}</label>
              {f.type === "longtext" ? (
                <textarea className="input" rows={2} value={fields[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)} />
              ) : (
                <input type={INPUT_TYPE[f.type] || "text"} className="input" value={fields[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)} />
              )}
            </div>
          ))}

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{fms.assignedLabel || "Assigned To"}</label>
            <input className="input" list="fms-assignees" placeholder="Pick a team member (or type any name)" autoComplete="off" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            <datalist id="fms-assignees">
              {salespersons.map((s) => <option key={s} value={s} />)}
            </datalist>
            <p className="text-[11px] text-gray-400 mt-1">Pick a team member from the list so they can see this lead and mark its steps done. Any other name is just a label.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : editing ? "Save Changes" : "Add Entry"}</button>
        </div>
      </form>
    </Modal>
  );
}
