import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal.jsx";
import api from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";
import { STAGES } from "../../constants/index.js";

export default function QuickUpdateModal({ open, lead, onClose, onSaved }) {
  const [stage, setStage] = useState(STAGES[0]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (lead) {
      setStage(lead.stage);
      setRemark("");
    }
  }, [lead]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/leads/${lead._id}/quick-update`, { stage, remark: remark || undefined });
      push("Lead updated.", "success");
      onSaved();
    } catch (err) {
      push(err.response?.data?.msg || "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Quick Update — ${lead?.siteName || ""}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Stage</label>
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Remark (optional)</label>
          <textarea className="input" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="What happened?" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Update"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
