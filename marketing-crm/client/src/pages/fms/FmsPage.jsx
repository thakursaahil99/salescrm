import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Clock, CalendarDays, Settings, Eye, Pencil, Trash2, LayoutList, PieChart } from "lucide-react";
import api from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { Countdown, overallStatus, nextStep, STATUS_LABEL, STATUS_CLASS, fmtHMS, fmtReal, hoursToHms, hmsToHours } from "./fmsUtils.jsx";
import FmsBuilderModal from "./FmsBuilderModal.jsx";
import EntryModal from "./EntryModal.jsx";
import ViewEntryModal from "./ViewEntryModal.jsx";
import HolidaysModal from "./HolidaysModal.jsx";
import FmsDashboard from "./FmsDashboard.jsx";
import Modal from "../../components/common/Modal.jsx";

export default function FmsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const { push } = useToast();

  const [fmsList, setFmsList] = useState([]);
  const [curId, setCurId] = useState("");
  const [entries, setEntries] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [tab, setTab] = useState("fms"); // "fms" | "dashboard"

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingFms, setEditingFms] = useState(null);
  const [entryModal, setEntryModal] = useState(null); // {entry|null}
  const [viewEntry, setViewEntry] = useState(null);
  const [timingsOpen, setTimingsOpen] = useState(false);
  const [holidaysOpen, setHolidaysOpen] = useState(false);

  // Dashboard drill-down: clicking a chart there jumps here to the FMS's entry list, filtered to
  // just the leads that chart element represents. `pendingViewId` is for the other kind of click —
  // a dashboard list row that already names ONE specific lead — which opens it directly once loaded.
  const [drill, setDrill] = useState(null); // { label, predicate } | null
  const [pendingViewId, setPendingViewId] = useState(null);

  const cur = useMemo(() => fmsList.find((f) => f.id === curId) || null, [fmsList, curId]);
  const visible = useMemo(() => (isAdmin ? fmsList : fmsList.filter((f) => f.count > 0)), [fmsList, isAdmin]);

  const loadFms = useCallback(async () => {
    const res = await api.get("/fms");
    const list = res.data.data;
    setFmsList(list);
    setCurId((prev) => {
      const vis = isAdmin ? list : list.filter((f) => f.count > 0);
      if (prev && vis.some((f) => f.id === prev)) return prev;
      return vis[0]?.id || list[0]?.id || "";
    });
    return list;
  }, [isAdmin]);

  const loadEntries = useCallback(async (id) => {
    if (!id) { setEntries([]); return; }
    const res = await api.get(`/fms/${id}/entries`);
    setEntries(res.data.data);
  }, []);

  useEffect(() => {
    loadFms();
    if (isAdmin) api.get("/users").then((res) => setSalespersons(res.data.data.filter((u) => u.role === "sales" && !u.frozen).map((u) => u.username)));
  }, [loadFms, isAdmin]);

  useEffect(() => {
    if (curId) loadEntries(curId);
  }, [curId, loadEntries]);

  const refresh = () => { loadFms(); if (curId) loadEntries(curId); };

  const deleteEntry = async (id) => {
    if (!confirm("Delete this FMS entry?")) return;
    try {
      await api.delete(`/fms/${curId}/entries/${id}`);
      push("FMS entry deleted.", "success");
      refresh();
    } catch (err) {
      push(err.response?.data?.msg || "Failed.", "error");
    }
  };

  const kpis = useMemo(() => {
    let onTime = 0, late = 0, overdue = 0;
    for (const e of entries) for (const s of e.steps) {
      if (s.status === "done_on_time") onTime++;
      else if (s.status === "done_late") late++;
      else if (s.status === "overdue") overdue++;
    }
    return { total: entries.length, onTime, late, overdue };
  }, [entries]);

  const filteredEntries = useMemo(() => (drill ? entries.filter(drill.predicate) : entries), [entries, drill]);

  // A dashboard chart click: jump to that FMS's list, filtered to the leads it represents.
  const goDrill = (fmsId, label, predicate) => {
    setPendingViewId(null);
    setCurId(fmsId);
    setDrill({ label, predicate });
    setTab("fms");
  };
  // A dashboard list-row click: it already names ONE lead — open it directly once its FMS's
  // entries have loaded (see the effect below).
  const goToEntry = (fmsId, entryId) => {
    setDrill(null);
    setCurId(fmsId);
    setPendingViewId(entryId);
    setTab("fms");
  };
  useEffect(() => {
    if (!pendingViewId) return;
    const found = entries.find((e) => e.id === pendingViewId);
    if (found) { setViewEntry(found); setPendingViewId(null); }
  }, [entries, pendingViewId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-gray-200">
        <TabButton active={tab === "fms"} onClick={() => setTab("fms")} icon={LayoutList} label="FMS" />
        {isAdmin && <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={PieChart} label="Dashboard" />}
      </div>

      {tab === "dashboard" ? (
        <FmsDashboard fmsList={fmsList} onDrill={goDrill} onOpenEntry={goToEntry} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {visible.map((f) => (
              <button
                key={f.id}
                onClick={() => { setCurId(f.id); setDrill(null); }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${f.id === curId ? "bg-brand text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-brand hover:text-brand"}`}
              >
                {f.name}
                <span className={`text-[10px] font-bold rounded-full px-1.5 ${f.id === curId ? "bg-white/25" : "bg-gray-100"}`}>{f.count}</span>
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => { setEditingFms(null); setBuilderOpen(true); }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border border-dashed border-brand text-brand">
                <Plus size={14} /> New FMS
              </button>
            )}
          </div>

          {cur && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">{isAdmin ? cur.name : "My Tasks"}</h1>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <>
                      <button className="btn-secondary" onClick={() => setHolidaysOpen(true)}><CalendarDays size={15} /> Holidays</button>
                      <button className="btn-secondary" onClick={() => { setEditingFms(cur); setBuilderOpen(true); }}><Settings size={15} /> Edit FMS</button>
                      <button className="btn-secondary" onClick={() => setTimingsOpen(true)}><Clock size={15} /> Step Timings</button>
                      <button className="btn-primary" onClick={() => setEntryModal({ entry: null })}><Plus size={15} /> Add FMS Entry</button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label={isAdmin ? "Total Entries" : "My Leads"} value={kpis.total} />
                <KpiCard label="Steps On Time" value={kpis.onTime} accent="text-green-600" />
                <KpiCard label="Steps Overdue" value={kpis.overdue} accent="text-red-600" />
                <KpiCard label="Steps Late" value={kpis.late} accent="text-orange-600" />
              </div>

              {drill && (
                <div className="flex items-center gap-2 text-xs bg-brand-50 border border-brand-light/50 text-brand-dark px-3 py-2 rounded-lg">
                  <span>Filtered from Dashboard: <b>{drill.label}</b> ({filteredEntries.length} of {entries.length})</span>
                  <button className="ml-auto font-semibold hover:underline" onClick={() => setDrill(null)}>Clear ✕</button>
                </div>
              )}

              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                      <th className="p-3">{cur.uidLabel}</th>
                      <th className="p-3">{cur.fields[0]?.label}{cur.fields[1] ? ` / ${cur.fields[1].label}` : ""}</th>
                      <th className="p-3">{cur.assignedLabel || "Assigned To"}</th>
                      <th className="p-3">Next Step</th>
                      <th className="p-3">Overall</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-400">{drill ? "No leads match this filter." : isAdmin ? "No FMS entries yet." : "No leads are assigned to you yet."}</td></tr>
                    ) : (
                      filteredEntries.map((e) => {
                        const ns = nextStep(e.steps);
                        const overall = overallStatus(e.steps);
                        const anyDone = e.steps.some((s) => s.status === "done_on_time" || s.status === "done_late");
                        const anyWaiting = e.steps.some((s) => s.status === "waiting");
                        return (
                          <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setViewEntry(e)}>
                            <td className="p-3 font-mono text-xs">{e.uid}</td>
                            <td className="p-3">
                              <p className="font-semibold text-gray-800">{e.title}</p>
                              {e.sub && <p className="text-xs text-gray-400">{e.sub}</p>}
                            </td>
                            <td className="p-3 text-gray-600">{e.assignedTo || "—"}</td>
                            <td className="p-3">
                              {ns ? (
                                <span className="flex items-center gap-2">{ns.label} <Countdown plannedTs={ns.plannedTs} /></span>
                              ) : anyDone && !anyWaiting ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">All Done</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">Not Set</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLASS[overall]}`}>{STATUS_LABEL[overall]}</span>
                            </td>
                            <td className="p-3" onClick={(e2) => e2.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <button className="btn-icon" title="View" onClick={() => setViewEntry(e)}><Eye size={15} /></button>
                                {isAdmin && (
                                  <>
                                    <button className="btn-icon" title="Edit" onClick={() => setEntryModal({ entry: e })}><Pencil size={15} /></button>
                                    <button className="btn-icon text-red-500" title="Delete" onClick={() => deleteEntry(e.id)}><Trash2 size={15} /></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {isAdmin && (
        <FmsBuilderModal
          open={builderOpen}
          fms={editingFms}
          onClose={() => setBuilderOpen(false)}
          onSaved={(saved) => { setBuilderOpen(false); setCurId(saved.id); refresh(); }}
          onDeleted={() => { setBuilderOpen(false); setCurId(""); refresh(); }}
        />
      )}
      {cur && (
        <EntryModal
          open={!!entryModal}
          fms={cur}
          entry={entryModal?.entry || null}
          salespersons={salespersons}
          onClose={() => setEntryModal(null)}
          onSaved={() => { setEntryModal(null); refresh(); }}
        />
      )}
      {cur && viewEntry && (
        <ViewEntryModal open={!!viewEntry} fms={cur} entry={viewEntry} onClose={() => setViewEntry(null)} onChanged={refresh} />
      )}
      {cur && (
        <TimingsModal open={timingsOpen} fms={cur} onClose={() => setTimingsOpen(false)} onSaved={() => { setTimingsOpen(false); refresh(); }} />
      )}
      <HolidaysModal open={holidaysOpen} onClose={() => setHolidaysOpen(false)} onChanged={refresh} />
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${active ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
      <Icon size={16} /> {label}
    </button>
  );
}

function KpiCard({ label, value, accent = "text-gray-900" }) {
  return (
    <div className="card p-4 border-t-4 border-t-brand">
      <p className={`text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

function TimingsModal({ open, fms, onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [apply, setApply] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (open && fms) {
      setRows(fms.steps.map((s) => ({ ...hoursToHms(s.hours) })));
      setApply(false);
    }
  }, [open, fms]);

  if (!fms) return null;
  const setRow = (i, patch) => setRows((r) => r.map((row, k) => (k === i ? { ...row, ...patch } : row)));

  const save = async () => {
    const hours = rows.map((r) => hmsToHours(r.h, r.m, r.s));
    try {
      const res = await api.put(`/fms/${fms.id}/timings`, { hours, applyToExisting: apply });
      push(apply ? `Timings saved. ${res.data.updated} ${res.data.updated === 1 ? "entry" : "entries"} updated.` : "Timings saved.", "success");
      onSaved();
    } catch (err) {
      push(err.response?.data?.msg || "Failed.", "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="⏱ Step Timings" wide>
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3">
          Same timings for every entry of this FMS — enter each step as <b>hr / min / sec</b>. The deadline is <b>exactly the time you enter</b>. <b>Step 1</b> runs from the entry date &amp; time. <b>Every next step starts only when the step before it is marked done</b>: its deadline = that moment + its time. Sundays and company holidays are not counted.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fms.steps.map((s, i) => (
            <div key={s.key} className="border border-gray-200 rounded-lg p-3">
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{i + 1}. {s.label}</label>
              <div className="flex gap-1.5">
                <input type="number" min="0" className="input" placeholder="hr" value={rows[i]?.h || ""} onChange={(e) => setRow(i, { h: e.target.value })} />
                <input type="number" min="0" className="input" placeholder="min" value={rows[i]?.m || ""} onChange={(e) => setRow(i, { m: e.target.value })} />
                <input type="number" min="0" className="input" placeholder="sec" value={rows[i]?.s || ""} onChange={(e) => setRow(i, { s: e.target.value })} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {(() => { const h = hmsToHours(rows[i]?.h, rows[i]?.m, rows[i]?.s); return h > 0 ? `Deadline = ${i === 0 ? "entry time" : "when step " + i + " is done"} + ${fmtReal(Math.round(h * 3600))}` : ""; })()}
              </p>
            </div>
          ))}
        </div>
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={apply} onChange={(e) => setApply(e.target.checked)} />
          <span>Also apply to existing entries — recalculates their Planned dates (each step counts from when the step before it was done). Actual times already recorded stay as they are, but a step can change between On Time / Late.</span>
        </label>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save Timings</button>
        </div>
      </div>
    </Modal>
  );
}
