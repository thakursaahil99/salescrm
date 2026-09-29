import { useEffect, useState } from "react";
import Modal from "../../../marketing-lib/Modal.jsx";
import api from "../../../services/marketingApi.js";
import { useToast } from "../../../marketing-lib/useToast.js";
import { CLIENT_TYPES, CATALOGUE_STATUS, COMM_MODES, STAGES } from "../../../marketing-lib/constants.js";
import { looksLikePhoneNumber } from "../../../marketing-lib/validators.js";

export default function EditLeadModal({ open, lead, onClose, onSaved, salespersons, isAdmin }) {
  const [form, setForm] = useState(null);
  const [newRemark, setNewRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (lead) {
      setForm({
        clientType: lead.clientType,
        siteName: lead.siteName,
        totalNo: lead.totalNo,
        location: lead.location,
        contactPerson: lead.contactPerson,
        contactNo: lead.contactNo,
        catalogue: lead.catalogue,
        modeComm: lead.modeComm,
        stage: lead.stage,
        email: lead.email,
        leadHead: lead.leadHead,
      });
      setNewRemark("");
    }
  }, [lead]);

  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.siteName.trim()) return push("Site name is required.", "error");
    if (looksLikePhoneNumber(form.contactPerson)) {
      return push("Contact Person looks like a phone number — did you mean to put that in Contact No. instead?", "error");
    }
    setSaving(true);
    try {
      await api.put(`/leads/${lead._id}`, { ...form, newRemark: newRemark || undefined });
      push("Lead updated.", "success");
      onSaved();
    } catch (err) {
      push(err.response?.data?.msg || "Failed to update lead.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Lead — ${lead?.siteName || ""}`} wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Client Type</label>
          <select className="input" value={form.clientType} onChange={set("clientType")}>
            {CLIENT_TYPES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Site Name</label>
          <input className="input" value={form.siteName} onChange={set("siteName")} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Total Students / Beds / Staff</label>
          <input className="input" value={form.totalNo} onChange={set("totalNo")} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Location</label>
          <input className="input" value={form.location} onChange={set("location")} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Contact Person</label>
          <input className="input" value={form.contactPerson} onChange={set("contactPerson")} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Contact No.</label>
          <input className="input" value={form.contactNo} onChange={set("contactNo")} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Catalogue Given</label>
          <select className="input" value={form.catalogue} onChange={set("catalogue")}>
            <option value="">—</option>
            {CATALOGUE_STATUS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Mode of Communication</label>
          <select className="input" value={form.modeComm} onChange={set("modeComm")}>
            <option value="">—</option>
            {COMM_MODES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Stage</label>
          <select className="input" value={form.stage} onChange={set("stage")}>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
          <input className="input" value={form.email} onChange={set("email")} />
        </div>
        {isAdmin && (
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Lead Head (Rep)</label>
            <select className="input" value={form.leadHead} onChange={set("leadHead")}>
              {salespersons.map((s) => (
                <option key={s.username} value={s.username}>
                  {s.username}
                </option>
              ))}
              {!salespersons.some((s) => s.username === form.leadHead) && (
                <option value={form.leadHead}>{form.leadHead}</option>
              )}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Add Remark (optional)</label>
          <textarea className="input" rows={2} value={newRemark} onChange={(e) => setNewRemark(e.target.value)} />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
