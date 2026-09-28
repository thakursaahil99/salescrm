import { useEffect, useState } from "react";
import { Clock, Bell, Plus } from "lucide-react";
import Modal from "../../../marketing-lib/Modal.jsx";
import api from "../../../services/marketingApi.js";
import { useToast } from "../../../marketing-lib/useToast.js";
import { StageBadge, ClientTypeBadge } from "../../../marketing-lib/Badge.jsx";

export default function ViewLeadModal({ open, lead, onClose }) {
  const [remarks, setRemarks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDt, setReminderDt] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const load = async () => {
    if (!lead) return;
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([api.get(`/leads/${lead._id}/remarks`), api.get(`/leads/${lead._id}/reminders`)]);
      setRemarks(r1.data.data);
      setReminders(r2.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && lead) {
      load();
      setShowReminderForm(false);
      setReminderDt("");
      setReminderNote("");
    }
  }, [open, lead]);

  if (!lead) return null;

  const addReminder = async (e) => {
    e.preventDefault();
    if (!reminderDt) return push("Pick a date/time.", "error");
    setSaving(true);
    try {
      await api.post(`/leads/${lead._id}/reminders`, { dateTime: reminderDt, note: reminderNote });
      push("Reminder set.", "success");
      setShowReminderForm(false);
      setReminderDt("");
      setReminderNote("");
      load();
    } catch (err) {
      push(err.response?.data?.msg || "Failed to set reminder.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={lead.siteName} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <ClientTypeBadge type={lead.clientType} />
          <StageBadge stage={lead.stage} />
          <span className="text-xs text-gray-400">Rep: {lead.leadHead}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Field label="Location" value={lead.location} />
          <Field label="Total Students/Beds/Staff" value={lead.totalNo} />
          <Field label="Contact Person" value={lead.contactPerson} />
          <Field label="Contact No." value={lead.contactNo} />
          <Field label="Catalogue" value={lead.catalogue} />
          <Field label="Mode of Comm." value={lead.modeComm} />
          <Field label="Email" value={lead.email} />
          <Field label="Created" value={lead.timestamp ? new Date(lead.timestamp).toLocaleString("en-IN") : ""} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <Clock size={14} /> Remarks History
            </h4>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-3">
            {loading ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : remarks.length === 0 ? (
              <p className="text-xs text-gray-400">No remarks yet.</p>
            ) : (
              remarks.map((r) => (
                <div key={r._id} className="text-xs bg-white rounded-md p-2 border border-gray-100">
                  <p className="text-gray-700">{r.fullText}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <Bell size={14} /> Reminders
            </h4>
            <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => setShowReminderForm((s) => !s)}>
              <Plus size={13} /> Add Reminder
            </button>
          </div>

          {showReminderForm && (
            <form onSubmit={addReminder} className="flex flex-wrap items-end gap-2 bg-gray-50 rounded-lg p-3 mb-2">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Date & Time</label>
                <input
                  type="datetime-local"
                  className="input !py-1.5 text-sm"
                  value={reminderDt}
                  onChange={(e) => setReminderDt(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Note</label>
                <input className="input !py-1.5 text-sm" value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} />
              </div>
              <button type="submit" disabled={saving} className="btn-primary !py-1.5 text-xs">
                {saving ? "Saving..." : "Set"}
              </button>
            </form>
          )}

          <div className="max-h-40 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-3">
            {reminders.length === 0 ? (
              <p className="text-xs text-gray-400">No reminders set.</p>
            ) : (
              reminders.map((r) => (
                <div key={r._id} className="text-xs bg-white rounded-md p-2 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-700">{new Date(r.dateTime).toLocaleString("en-IN")}</p>
                    {r.note && <p className="text-gray-500">{r.note}</p>}
                    <p className="text-gray-400">by {r.createdBy}</p>
                  </div>
                  <span
                    className={`badge !text-[10px] ${
                      r.status === "Pending" ? "bg-gray-100 text-gray-600" : r.status === "Sent" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase">{label}</p>
      <p className="text-gray-800">{value || "—"}</p>
    </div>
  );
}
