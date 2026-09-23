import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal.jsx";
import api from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { Countdown, STATUS_LABEL, STATUS_CLASS, fmtHMS, fmtIN, toInputDT } from "./fmsUtils.jsx";

// The details of one entry: every field, then its steps with live timers, Mark Done (always asks for a
// remark) and Reopen (admin, latest finished step only).
export default function ViewEntryModal({ open, onClose, fms, entry, onChanged }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const [markStep, setMarkStep] = useState(null); // {idx} while the remark prompt is open
  const [remark, setRemark] = useState("");
  const [remarkErr, setRemarkErr] = useState("");
  const [actualDate, setActualDate] = useState("");
  const { push } = useToast();

  if (!fms || !entry) return null;

  let lastDone = -1;
  entry.steps.forEach((s, i) => { if (s.actualTs) lastDone = i; });

  const openMark = (idx) => {
    setMarkStep(idx);
    setRemark("");
    setRemarkErr("");
    setActualDate(toInputDT(Date.now()));
  };

  const confirmMark = async () => {
    if (remark.trim().length < 3) return setRemarkErr("Please write a short remark (at least 3 characters) about this step.");
    try {
      await api.post(`/fms/${fms.id}/entries/${entry.id}/steps/${markStep}/done`, { remark, actualDate: isAdmin ? actualDate : undefined });
      push("Step marked done.", "success");
      setMarkStep(null);
      onChanged();
      onClose();
    } catch (err) {
      push(err.response?.data?.msg || "Failed.", "error");
    }
  };

  const reopen = async (idx) => {
    try {
      await api.post(`/fms/${fms.id}/entries/${entry.id}/steps/${idx}/reopen`);
      push("Step reopened.", "success");
      onChanged();
      onClose();
    } catch (err) {
      push(err.response?.data?.msg || "Failed.", "error");
    }
  };

  return (
    <>
      <Modal open={open && !markStep && markStep !== 0} onClose={onClose} title={`${entry.title}${entry.sub ? " — " + entry.sub : ""}`} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <Field label="Entry Date" value={fmtIN(entry.entryTs)} />
            <Field label={fms.uidLabel} value={entry.uid} />
            {fms.fields.map((f) => <Field key={f.key} label={f.label} value={entry.fields[f.key]} />)}
            <Field label={fms.assignedLabel || "Assigned To"} value={entry.assignedTo} />
          </div>

          <div className="space-y-2">
            {entry.steps.map((s, i) => {
              const canMark = s.status === "pending" || s.status === "overdue";
              const canReopen = isAdmin && i === lastDone;
              const waiting = s.status === "waiting";
              return (
                <div key={s.key} className="border border-gray-200 rounded-xl p-3 flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-brand-50 text-brand flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{s.label}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-0.5">
                      <span>Timing: {fmtHMS(s.hours)}</span>
                      <span>Planned: {s.plannedTs ? fmtIN(s.plannedTs) : waiting ? `starts after step ${i} is done` : "—"}</span>
                      <span>Actual: {s.actualTs ? fmtIN(s.actualTs) : "—"}</span>
                      {canMark ? <Countdown plannedTs={s.plannedTs} /> : waiting ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">🔒 Waiting for step {i}</span>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                      )}
                    </div>
                    {s.remark && (
                      <div className="mt-2 text-xs bg-blue-50 border-l-2 border-blue-400 rounded px-2.5 py-1.5 whitespace-pre-wrap">
                        <b>Remark:</b> {s.remark} {s.doneBy && <span className="text-gray-400">— {s.doneBy}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    {canMark && <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => openMark(i)}>✓ Mark Done</button>}
                    {canReopen && <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => reopen(i)}>Reopen</button>}
                  </div>
                </div>
              );
            })}
          </div>
          {!isAdmin && <p className="text-xs text-gray-400">Mark Done saves the current time as the finish time of that step and starts the timer of the next step.</p>}
        </div>
      </Modal>

      <Modal open={markStep !== null} onClose={() => setMarkStep(null)} title={markStep !== null ? `Mark "${entry.steps[markStep].label}" as done` : ""}>
        <div className="space-y-4">
          {isAdmin && (
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Finish date &amp; time</label>
              <input type="datetime-local" className="input" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Remark *</label>
            <textarea className="input" rows={4} maxLength={500} placeholder="What happened on this step? e.g. Met the client, quote sent, waiting for their reply" value={remark} onChange={(e) => setRemark(e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-1">Required. It is saved with the step, so the team can see what is happening on it.</p>
          </div>
          {remarkErr && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{remarkErr}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setMarkStep(null)}>Cancel</button>
            <button className="btn-primary" onClick={confirmMark}>✓ Mark Done</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium break-words">{value || "—"}</span>
    </div>
  );
}
