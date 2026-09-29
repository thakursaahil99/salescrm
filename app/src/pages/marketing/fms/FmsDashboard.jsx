import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import api from "../../../services/marketingApi.js";
import { COLOR, fmtDur, fmtShort, Countdown } from "./fmsUtils.jsx";

function pct(x) { return Math.round(x * 100); }
function rateClass(r) { return r == null ? "bg-gray-100 text-gray-500" : r >= 0.8 ? "bg-green-100 text-green-700" : r >= 0.5 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"; }
function RateChip({ r }) { return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${rateClass(r)}`}>{r == null ? "no data" : `${pct(r)}% on time`}</span>; }

// Same buckets as the server's SEVERITY const (routes/fms.js) — kept in sync so a click on a
// "How late are the delays?" bar can recompute exactly which entries fall in that bucket.
const SEVERITY_BUCKETS = [
  { label: "Under 1 hour", max: 3600 },
  { label: "1 - 6 hours", max: 6 * 3600 },
  { label: "6 - 24 hours", max: 24 * 3600 },
  { label: "Over 1 day", max: Infinity },
];
function sevIndexOf(sec) {
  for (let i = 0; i < SEVERITY_BUCKETS.length; i++) if (sec < SEVERITY_BUCKETS[i].max) return i;
  return SEVERITY_BUCKETS.length - 1;
}

// --- entry-level predicates, all working off the same shape /fms/:id/entries returns ---
const anySet = (e) => e.steps.some((s) => s.plannedTs);
const allDone = (e) => e.steps.every((s) => s.status === "done_on_time" || s.status === "done_late");
const isInProgress = (e) => anySet(e) && !allDone(e);
const isCompleted = (e) => anySet(e) && allDone(e);
const isOverdue = (e) => e.steps.some((s) => s.status === "overdue");
const isDueSoon = (e) => e.steps.some((s) => s.status === "pending" && s.plannedTs && s.plannedTs - Date.now() <= 24 * 3600 * 1000);
const isNoTimings = (e) => !anySet(e);
const currentStepIs = (e, i) => { const cur = e.steps.find((s) => s.status === "pending" || s.status === "overdue"); return cur && e.steps[i] === cur; };
const stepStatusIs = (e, i, status) => e.steps[i]?.status === status;
const anyStepStatusIs = (e, status) => e.steps.some((s) => s.status === status);
const assignedIs = (e, name) => (e.assignedTo || "") === (name || "");
const inSeverityBucket = (e, status, bucketIdx) => {
  const lo = bucketIdx === 0 ? 0 : SEVERITY_BUCKETS[bucketIdx - 1].max;
  const hi = SEVERITY_BUCKETS[bucketIdx].max;
  return e.steps.some((s) => {
    if (s.status !== status) return false;
    const sec = status === "done_late" ? (s.actualTs - s.plannedTs) / 1000 : (Date.now() - s.plannedTs) / 1000;
    return sec >= lo && sec < hi;
  });
};

const STEP_STATUS_LABEL = { done_on_time: "Finished on time", done_late: "Finished late", overdue: "Overdue", pending: "Running, on track" };

export default function FmsDashboard({ fmsList, onDrill, onOpenEntry }) {
  const [data, setData] = useState(null);
  const [fmsId, setFmsId] = useState("__all");
  const [person, setPerson] = useState("");
  const [days, setDays] = useState(0);

  const load = useCallback(async () => {
    const params = { fmsId: fmsList.length > 1 ? fmsId : fmsList[0]?.id, person: person || undefined, days: days || undefined };
    const res = await api.get("/fms/analytics", { params });
    setData(res.data);
  }, [fmsList, fmsId, person, days]);

  useEffect(() => { if (fmsList.length) load(); }, [fmsList, load]);

  if (!data) {
    return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  }
  const multi = data.scope === "all";
  const k = data.kpi;
  const singleFmsId = data.filter.fmsId !== "__all" ? data.filter.fmsId : null;

  const drill = (id, label, predicate) => { if (id && onDrill) onDrill(id, label, predicate); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-gray-400">Updated {new Date(data.serverNow).toLocaleTimeString()} · {multi ? "All FMS" : data.breakdown[0]?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {fmsList.length > 1 && (
            <select className="input w-auto" value={fmsId} onChange={(e) => setFmsId(e.target.value)}>
              <option value="__all">All FMS</option>
              {fmsList.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <select className="input w-auto" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Everyone</option>
            {data.people.map((p) => <option key={p} value={p}>{p}</option>)}
            {data.hasUnassigned && <option value="__none">(unassigned)</option>}
          </select>
          <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={0}>All time</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <Insights data={data} multi={multi} />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Total leads" value={k.totalEntries} sub={k.noTimings ? `${k.noTimings} without timings` : "in the FMS"} onClick={singleFmsId && (() => drill(singleFmsId, "All leads", () => true))} />
        <Kpi label="In progress" value={k.inProgress} sub="still have steps to do" accent="text-blue-600" onClick={singleFmsId && (() => drill(singleFmsId, "In progress", isInProgress))} />
        <Kpi label="Completed" value={k.completed} sub="all steps done" accent="text-green-600" onClick={singleFmsId && (() => drill(singleFmsId, "Completed", isCompleted))} />
        <Kpi label="On-time rate" value={k.onTimeRate == null ? "—" : `${pct(k.onTimeRate)}%`} sub={`${k.onTimeSteps} of ${k.judgedSteps} judged`} accent={k.onTimeRate == null ? "text-gray-400" : k.onTimeRate >= 0.8 ? "text-green-600" : k.onTimeRate >= 0.5 ? "text-orange-600" : "text-red-600"} />
        <Kpi label="Overdue now" value={k.overdueSteps} sub={`${k.overdueEntries} lead${k.overdueEntries === 1 ? "" : "s"} affected`} accent="text-red-600" onClick={singleFmsId && (() => drill(singleFmsId, "Overdue now", isOverdue))} />
        <Kpi label="Due in 24h" value={k.dueSoon24} sub="steps coming up" accent="text-orange-600" onClick={singleFmsId && (() => drill(singleFmsId, "Due in 24h", isDueSoon))} />
        <Kpi label="Avg delay" value={k.avgLateSec == null ? "—" : fmtDur(k.avgLateSec)} sub="on steps finished late" accent={k.avgLateSec == null ? "text-gray-400" : "text-orange-600"} />
      </div>

      {multi && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">All FMS at a glance</h3>
          <p className="text-xs text-gray-400 mb-3">Click a row to open that FMS's own dashboard.</p>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100"><th className="py-2 sticky left-0 z-[2] bg-white">FMS</th><th>Leads</th><th>In progress</th><th>Completed</th><th>On-time rate</th><th>Overdue now</th></tr></thead>
            <tbody>
              {data.breakdown.map((b) => (
                <tr key={b.id} className="group border-b border-gray-50 cursor-pointer hover:bg-gray-50" onClick={() => setFmsId(b.id)}>
                  <td className="py-2 font-semibold sticky left-0 z-[1] bg-white group-hover:bg-gray-50">{b.name}</td>
                  <td>{b.kpi.entries}</td><td>{b.kpi.inProgress}</td><td>{b.kpi.completed}</td>
                  <td>{b.kpi.judgedSteps ? <RateChip r={b.kpi.onTimeRate} /> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className={b.kpi.overdueSteps ? "text-red-600 font-bold" : ""}>{b.kpi.overdueSteps}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Where are the leads right now?</h3>
          <p className="text-xs text-gray-400 mb-3">Every lead is counted once, at the step running for it right now. Click a bar to see those leads.</p>
          {multi
            ? data.breakdown.map((b) => <PipelineBlock key={b.id} name={b.name} pipeline={b.pipeline} completed={b.kpi.completed} noTimings={b.kpi.noTimings} onPick={(label, predicate) => drill(b.id, label, predicate)} />)
            : <PipelineBlock pipeline={data.pipeline} completed={k.completed} noTimings={k.noTimings} onPick={(label, predicate) => drill(singleFmsId, label, predicate)} />}
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">All steps at a glance</h3>
          <p className="text-xs text-gray-400 mb-3">Share of every step that has started. Steps still waiting for the step before them are not counted.</p>
          <Donut mix={data.mix} rate={k.onTimeRate} onPick={singleFmsId ? (status) => drill(singleFmsId, STEP_STATUS_LABEL[status], (e) => anyStepStatusIs(e, status)) : null} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Step health — where do delays happen?</h3>
          <p className="text-xs text-gray-400 mb-3">Each bar is one step across all leads. Click a segment to see those leads.</p>
          {multi
            ? data.breakdown.map((b) => <StepHealthBlock key={b.id} name={b.name} stepHealth={b.stepHealth} onPick={(i, status, label) => drill(b.id, label, (e) => stepStatusIs(e, i, status))} />)
            : <StepHealthBlock stepHealth={data.stepHealth} onPick={(i, status, label) => drill(singleFmsId, label, (e) => stepStatusIs(e, i, status))} />}
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2">How late are the delays?</h3>
          <SeverityChart severity={data.severity} onPick={singleFmsId ? (status, bucketIdx, label) => drill(singleFmsId, label, (e) => inSeverityBucket(e, status, bucketIdx)) : null} />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Team performance</h3>
        <p className="text-xs text-gray-400 mb-3">Sorted worst first: most overdue steps on top. Click a person to see their leads.</p>
        <TeamTable team={data.team} multi={multi} onPick={singleFmsId ? (name, label) => drill(singleFmsId, label, (e) => assignedIs(e, name)) : null} />
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-2">Completed steps per week</h3>
        <WeeklyChart weekly={data.weekly} />
      </div>

      <ListCard title="🔥 Overdue right now" hint="Most overdue first. Click a row to open it." rows={data.overdueList} multi={multi} kind="overdue" onOpenEntry={onOpenEntry} />
      <ListCard title="⏳ Due in the next 24 hours" hint="Soonest first. Click a row to open it." rows={data.dueSoon} multi={multi} kind="due" onOpenEntry={onOpenEntry} />
      <ListCard title="🟠 Recently finished late" hint="The latest steps completed after their deadline. Click a row to open it." rows={data.recentLate} multi={multi} kind="late" onOpenEntry={onOpenEntry} />
    </div>
  );
}

function Insights({ data, multi }) {
  const k = data.kpi;
  const out = (data.problems || []).map((p) => `⚠ ${p.error} It is left out of these numbers.`);
  if (!k.totalEntries) out.push("No leads match this view yet. Add an FMS entry (or change the filters) to see the analysis.");
  else {
    out.push(k.onTimeRate != null
      ? `On-time rate is <b>${pct(k.onTimeRate)}%</b> — ${k.onTimeSteps} of ${k.judgedSteps} steps were finished on time (${k.onTimeRate >= 0.8 ? "healthy ✅" : k.onTimeRate >= 0.5 ? "needs attention ⚠️" : "poor 🔴"}).`
      : "No step has been judged yet — deadlines have not arrived and nothing is finished.");
    const steps = multi ? data.breakdown.flatMap((b) => b.stepHealth.map((s) => ({ ...s, label: `${b.name} › ${s.label}` }))) : data.stepHealth || [];
    let worst = null;
    for (const s of steps) { const delayed = s.late + s.overdue, judged = s.onTime + s.late + s.overdue; if (delayed > 0 && (!worst || delayed > worst.delayed)) worst = { s, delayed, judged }; }
    if (worst) out.push(`Biggest bottleneck: <b>${worst.s.label}</b> — ${worst.delayed} of ${worst.judged} judged steps are delayed.`);
    if (k.overdueSteps > 0) {
      const top = [...data.team].filter((t) => t.overdue > 0).sort((a, b) => b.overdue - a.overdue)[0];
      out.push(`<b>${k.overdueSteps}</b> step${k.overdueSteps === 1 ? " is" : "s are"} overdue right now across ${k.overdueEntries} lead${k.overdueEntries === 1 ? "" : "s"}${top ? ` — most with <b>${top.name}</b> (${top.overdue})` : ""}.`);
    } else out.push("🎉 Nothing is overdue right now.");
    if (k.dueSoon24 > 0) out.push(`<b>${k.dueSoon24}</b> step${k.dueSoon24 === 1 ? " is" : "s are"} due in the next 24 hours.`);
    const unassigned = data.team.find((t) => t.unassigned && t.entries > 0);
    if (unassigned) out.push(`⚠ <b>${unassigned.entries}</b> lead${unassigned.entries === 1 ? " is" : "s are"} not assigned to anyone.`);
    const noLogin = data.team.filter((t) => !t.unassigned && !t.hasLogin && t.entries > 0);
    if (noLogin.length) out.push(`⚠ ${noLogin.map((t) => t.name).join(", ")} ${noLogin.length === 1 ? "has" : "have"} leads but no login.`);
  }
  return (
    <div className="card p-4 border-l-4 border-l-blue-500">
      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Quick read</h4>
      <ul className="space-y-1 text-sm text-gray-700">
        {out.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
      </ul>
    </div>
  );
}

function Kpi({ label, value, sub, accent = "text-gray-900", onClick }) {
  return (
    <div
      className={`card p-3.5 border-t-4 border-t-brand ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" : ""}`}
      onClick={onClick || undefined}
      title={onClick ? "Click to see these leads" : undefined}
    >
      <p className={`text-xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function PipelineBlock({ name, pipeline, completed, noTimings, onPick }) {
  const max = Math.max(completed, noTimings, 1, ...pipeline.map((r) => r.onTrack + r.overdue));
  const row = (label, onTrack, overdue, total, colorClass, onClick) => (
    <div
      key={label}
      className={`grid grid-cols-[140px_1fr_60px] items-center gap-2 mb-1.5 ${onClick && total > 0 ? "cursor-pointer hover:bg-gray-50 rounded" : ""}`}
      onClick={total > 0 ? onClick : undefined}
      title={onClick && total > 0 ? "Click to see these leads" : undefined}
    >
      <span className="text-xs text-gray-600 truncate">{label}</span>
      <div className="h-5 bg-gray-100 rounded-full overflow-hidden flex" style={{ width: `${(total / max) * 100}%`, minWidth: total ? "4px" : 0 }}>
        {onTrack > 0 && <div style={{ flex: onTrack, background: COLOR.pending }} title={`On track: ${onTrack}`} />}
        {overdue > 0 && <div style={{ flex: overdue, background: COLOR.overdue }} title={`Overdue: ${overdue}`} />}
        {colorClass && total > 0 && <div style={{ flex: total, background: colorClass }} />}
      </div>
      <span className="text-xs font-bold text-right">{total}{overdue ? <small className="block text-red-600 font-semibold">{overdue} overdue</small> : null}</span>
    </div>
  );
  return (
    <div className="mb-3">
      {name && <p className="text-xs font-bold text-gray-500 mb-1.5 border-b border-gray-100 pb-1">{name}</p>}
      {pipeline.map((r, i) => row(`${i + 1}. ${r.label}`, r.onTrack, r.overdue, r.onTrack + r.overdue, null, onPick && (() => onPick(r.label, (e) => currentStepIs(e, i)))))}
      {row("✅ Completed", 0, 0, completed, COLOR.onTime, onPick && (() => onPick("Completed", isCompleted)))}
      {noTimings > 0 && row("No timings set", 0, 0, noTimings, COLOR.none, onPick && (() => onPick("No timings set", isNoTimings)))}
    </div>
  );
}

function StepHealthBlock({ name, stepHealth, onPick }) {
  return (
    <div className="mb-3">
      {name && <p className="text-xs font-bold text-gray-500 mb-1.5 border-b border-gray-100 pb-1">{name}</p>}
      {stepHealth.map((s, i) => {
        const total = s.onTime + s.late + s.overdue + s.pending;
        const seg = (n, status, bg, key) => n > 0 && (
          <div
            key={key}
            style={{ flex: n, background: bg }}
            className="text-white text-[9px] font-bold text-center leading-4 cursor-pointer hover:brightness-110"
            title={`${STEP_STATUS_LABEL[status]}: ${n} — click to see`}
            onClick={(ev) => { ev.stopPropagation(); onPick?.(i, status, `${s.label}: ${STEP_STATUS_LABEL[status]}`); }}
          >
            {n}
          </div>
        );
        return (
          <div key={i} className="grid grid-cols-[140px_1fr_100px] items-center gap-2 mb-1.5">
            <span className="text-xs text-gray-600 truncate">{i + 1}. {s.label}</span>
            <div className="h-4 bg-gray-100 rounded flex overflow-hidden">
              {total > 0 ? (
                <>
                  {seg(s.onTime, "done_on_time", COLOR.onTime, "ot")}
                  {seg(s.late, "done_late", COLOR.late, "l")}
                  {seg(s.overdue, "overdue", COLOR.overdue, "o")}
                  {seg(s.pending, "pending", COLOR.pending, "p")}
                </>
              ) : null}
            </div>
            <span className="text-right text-xs">{total ? <RateChip r={s.rate} /> : <span className="text-gray-400">no data</span>}</span>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ mix, rate, onPick }) {
  const segs = [
    { name: "Finished on time", value: mix.onTime, color: COLOR.onTime, status: "done_on_time" },
    { name: "Finished late", value: mix.late, color: COLOR.late, status: "done_late" },
    { name: "Overdue now", value: mix.overdue, color: COLOR.overdue, status: "overdue" },
    { name: "Running, on track", value: mix.pending, color: COLOR.pending, status: "pending" },
  ];
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="text-center text-gray-400 text-sm py-8">No started steps yet.<br />Set the Step Timings, then add a lead.</div>;
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <div className="relative w-40 h-40">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={segs.filter((s) => s.value > 0)}
              dataKey="value"
              innerRadius="65%"
              outerRadius="100%"
              paddingAngle={2}
              onClick={onPick ? (d) => onPick(d.status) : undefined}
              cursor={onPick ? "pointer" : "default"}
            >
              {segs.filter((s) => s.value > 0).map((s, i) => <Cell key={i} fill={s.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <b className="text-lg">{rate == null ? "—" : `${pct(rate)}%`}</b>
          <span className="text-[10px] text-gray-400 uppercase">on time</span>
        </div>
      </div>
      <div className="text-xs space-y-1.5">
        {segs.map((s) => (
          <div
            key={s.name}
            className={`flex items-center gap-2 ${onPick && s.value > 0 ? "cursor-pointer hover:opacity-70" : ""}`}
            onClick={onPick && s.value > 0 ? () => onPick(s.status) : undefined}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600">{s.name}</span>
            <b className="ml-auto">{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityChart({ severity, onPick }) {
  const any = severity.some((b) => b.late + b.overdue > 0);
  if (!any) return <div className="text-center text-gray-400 text-sm py-8">No delayed steps. 🎉</div>;
  const clickHandler = (status) => (barData) => {
    if (!onPick) return;
    const idx = SEVERITY_BUCKETS.findIndex((b) => b.label === barData.label);
    if (idx < 0) return;
    onPick(status, idx, `${barData.label}: ${STEP_STATUS_LABEL[status]}`);
  };
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={severity}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="late" name="Finished late" stackId="a" fill={COLOR.late} cursor={onPick ? "pointer" : "default"} onClick={clickHandler("done_late")} />
        <Bar dataKey="overdue" name="Still overdue" stackId="a" fill={COLOR.overdue} cursor={onPick ? "pointer" : "default"} onClick={clickHandler("overdue")} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WeeklyChart({ weekly }) {
  const any = weekly.some((w) => w.onTime + w.late > 0);
  if (!any) return <div className="text-center text-gray-400 text-sm py-8">No step has been completed in the last 8 weeks yet.</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={weekly}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="onTime" name="Finished on time" stackId="a" fill={COLOR.onTime} />
        <Bar dataKey="late" name="Finished late" stackId="a" fill={COLOR.late} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TeamTable({ team, multi, onPick }) {
  if (!team.length) return <div className="text-center text-gray-400 text-sm py-8">No people or leads to show.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100"><th className="py-2 sticky left-0 z-[2] bg-white">Person</th><th>Leads</th><th>Steps done</th><th>On-time rate</th><th>Late</th><th>Overdue now</th><th>Avg delay</th></tr></thead>
        <tbody>
          {team.map((t) => (
            <tr
              key={t.name}
              className={`group border-b border-gray-50 ${onPick && t.entries > 0 ? "cursor-pointer hover:bg-gray-50" : ""}`}
              onClick={onPick && t.entries > 0 ? () => onPick(t.unassigned ? "" : t.name, `${t.name}'s leads`) : undefined}
              title={onPick && t.entries > 0 ? "Click to see this person's leads" : undefined}
            >
              <td className="py-2 font-semibold sticky left-0 z-[1] bg-white group-hover:bg-gray-50">{t.name}{!t.unassigned && !t.hasLogin ? <span className="ml-1.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">no login</span> : null}</td>
              <td>{t.entries}</td><td>{t.done}</td>
              <td>{t.onTime + t.late + t.overdue ? <RateChip r={t.rate} /> : <span className="text-gray-400 text-xs">—</span>}</td>
              <td>{t.late}</td>
              <td className={t.overdue ? "text-red-600 font-bold" : ""}>{t.overdue}</td>
              <td>{t.avgLateSec != null ? fmtDur(t.avgLateSec) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListCard({ title, hint, rows, multi, kind, onOpenEntry }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-0.5">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      {rows.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-6">{kind === "overdue" ? "No step is overdue right now. 🎉" : kind === "due" ? "Nothing is due in the next 24 hours." : "No step has been finished late. 🎉"}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="py-2 sticky left-0 z-[2] bg-white">Lead</th><th>Step</th><th>Assigned</th><th>Planned</th>
                {kind === "late" ? <><th>Finished</th><th>Late by</th><th>Remark</th></> : <th>Time</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => (
                <tr
                  key={i}
                  className={`group border-b border-gray-50 ${onOpenEntry ? "cursor-pointer hover:bg-gray-50" : ""}`}
                  onClick={onOpenEntry ? () => onOpenEntry(x.fmsId, x.id) : undefined}
                  title={onOpenEntry ? "Click to open this lead" : undefined}
                >
                  <td className="py-2 sticky left-0 z-[1] bg-white group-hover:bg-gray-50"><span className="font-semibold">{x.name}</span><br /><small className="text-gray-400">{x.companyName}{multi && x.fms ? ` · ${x.fms}` : ""}</small></td>
                  <td>{x.step}</td>
                  <td className="whitespace-nowrap">{x.assignedTo || "—"}</td>
                  <td className="whitespace-nowrap text-xs text-gray-500">{fmtShort(x.plannedTs)}</td>
                  {kind === "late" ? (
                    <>
                      <td className="whitespace-nowrap text-xs text-gray-500">{fmtShort(x.actualTs)}</td>
                      <td><span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700">{fmtDur(x.lateSec)}</span></td>
                      <td className="text-xs text-gray-500 max-w-[220px]">{x.remark}{x.doneBy ? <span className="text-gray-400"> — {x.doneBy}</span> : null}</td>
                    </>
                  ) : (
                    <td><Countdown plannedTs={x.plannedTs} /></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
