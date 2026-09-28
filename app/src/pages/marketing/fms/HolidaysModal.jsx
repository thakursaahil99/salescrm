import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Modal from "../../../marketing-lib/Modal.jsx";
import api from "../../../services/marketingApi.js";
import { useToast } from "../../../marketing-lib/useToast.js";

function dateLabel(key) {
  try {
    return new Date(key + "T00:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  } catch {
    return key;
  }
}

// Company holidays, shared by every FMS. Sunday is always off too (fixed, not editable here).
export default function HolidaysModal({ open, onClose, onChanged }) {
  const [list, setList] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const { push } = useToast();

  const load = async () => {
    const res = await api.get("/fms/holidays");
    setList(res.data.data.list);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const add = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/fms/holidays", { from, to, name });
      const n = res.data.data.added;
      push(n ? `${n} ${n === 1 ? "holiday" : "holidays"} added. Deadlines updated.` : "Those days were already in the list.", "success");
      setFrom(""); setTo(""); setName("");
      setList(res.data.data.list);
      onChanged();
    } catch (err) {
      push(err.response?.data?.msg || "Failed to add.", "error");
    }
  };

  const remove = async (date) => {
    try {
      const res = await api.delete(`/fms/holidays/${date}`);
      push("Holiday removed. Deadlines updated.", "success");
      setList(res.data.data.list);
      onChanged();
    } catch (err) {
      push(err.response?.data?.msg || "Failed.", "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="🗓 Company holidays" wide>
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3">
          On a holiday the clock stops: that day is <b>not counted</b> towards any deadline. <b>Every Sunday is always a holiday.</b> Example: a 48-hour step filled in on Monday, with Tuesday a holiday, is due on Thursday (same time of day). Adding or removing a holiday recalculates the deadlines of all entries at once.
        </div>

        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">From *</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">To (optional, for several days)</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Holiday name (optional)</label>
            <input className="input" maxLength={60} placeholder="e.g. Diwali" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">+ Add holiday</button>
        </form>

        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-2">Holidays</h4>
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 mb-2 text-sm">
            <span><b>Every Sunday</b> <span className="text-gray-400">— always a holiday</span></span>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {list.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No holidays added yet.</p>}
            {list.map((h) => (
              <div key={h.date} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm">
                <span>
                  <b>{dateLabel(h.date)}</b>
                  {h.name && <span className="text-gray-400"> — {h.name}</span>}
                </span>
                <button className="btn-icon text-red-500" title="Remove this holiday" onClick={() => remove(h.date)}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
