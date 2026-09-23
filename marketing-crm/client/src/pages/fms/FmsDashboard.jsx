import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import api from "../../lib/api.js";
import { COLOR, fmtDur, fmtShort, Countdown } from "./fmsUtils.jsx";

function pct(x) { return Math.round(x * 100); }
function rateClass(r) { return r == null ? "bg-gray-100 text-gray-500" : r >= 0.8 ? "bg-green-100 text-green-700" : r >= 0.5 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"; }
function RateChip({ r }) { return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${rateClass(r)}`}>{r == null ? "no data" : `${pct(r)}% on time`}</span>; }

export default function FmsDashboard({ fmsList }) {
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
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
        <Kpi label="Total leads" value={k.totalEntries} sub={k.noTimings ? `${k.noTimings} without timings` : "in the FMS"} />
        <Kpi label="In progress" value={k.inProgress} sub="still have steps to do" accent="text-blue-600" />
        <Kpi label="Completed" value={k.completed} sub="all steps done" accent="text-green-600" />
        <Kpi label="On-time rate" value={k.onTimeRate == null ? "—" : `${pct(k.onTimeRate)}%`} sub={`${k.onTimeSteps} of ${k.judgedSteps} judged`} accent={k.onTimeRate == null ? "text-gray-400" : k.onTimeRate >= 0.8 ? "text-green-600" : k.onTimeRate >= 0.5 ? "text-orange-600" : "text-red-600"} />
        <Kpi label="Overdue now" value={k.overdueSteps} sub={`${k.overdueEntries} lead${k.overdueEntries === 1 ? "" : "s"} affected`} accent="text-red-600" />
        <Kpi label="Due in 24h" value={k.dueSoon24} sub="steps coming up" accent="text-orange-600" />
        <Kpi label="Avg delay" value={k.avgLateSec == null ? "—" : fmtDur(k.avgLateSec)} sub="on steps finished late" accent={k.avgLateSec == null ? "text-gray-400" : "text-orange-600"} />
      </div>

      {multi && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">All FMS at a glance</h3>
          <p className="text-xs text-gray-400 mb-3">Click a row to open that FMS's own dashboard.</p>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100"><th className="py-2">FMS</th><th>Leads</th><th>In progress</th><th>Completed</th><th>On-time rate</th><th>Overdue now</th></tr></thead>
            <tbody>
              {data.breakdown.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50" onClick={() => setFmsId(b.id)}>
                  <td className="py-2 font-semibold">{b.name}</td>
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
          <p className="text-xs text-gray-400 mb-3">Every lead is counted once, at the step running for it right now.</p>
          {multi ? data.breakdown.map((b) => <PipelineBlock key={b.id} name={b.name} pipeline={b.pipeline} completed={b.kpi.completed} noTimings={b.kpi.noTimings} />) : <PipelineBlock pipeline={data.pipeline} completed={k.completed} noTimings={k.noTimings} />}
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">All steps at a glance</h3>
          <p className="text-xs text-gray-400 mb-3">Share of every step that has started. Steps still waiting for the step before them are not counted.</p>
          <Donut mix={data.mix} rate={k.onTimeRate} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Step health — where do delays happen?</h3>
          <p className="text-xs text-gray-400 mb-3">Each bar is one step across all leads.</p>
          {multi ? data.breakdown.map((b) => <StepHealthBlock key={b.id} name={b.name} stepHealth={b.stepHealth} />) : <StepHealthBlock stepHealth={data.stepHealth} />}
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2">How late are the delays?</h3>
          <SeverityChart severity={data.severity} />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Team performance</h3>
        <p className="text-xs text-gray-400 mb-3">Sorted worst first: most overdue steps on top.</p>
        <TeamTable team={data.team} multi={multi} />
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-2">Completed steps per week</h3>
        <WeeklyChart weekly={data.weekly} />
      </div>

      <ListCard title="🔥 Overdue right now" hint="Most overdue first." rows={data.overdueList} multi={multi} kind="overdue" />
      <ListCard title="⏳ Due in the next 24 hours" hint="Soonest first." rows={data.dueSoon} multi={multi} kind="due" />
      <ListCard title="🟠 Recently finished late" hint="The latest steps completed after their deadline." rows={data.recentLate} multi={multi} kind="late" />
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

function Kpi({ label, value, sub, accent = "text-gray-900" }) {
  return (
    <div className="card p-3.5 border-t-4 border-t-brand">
      <p className={`text-xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function PipelineBlock({ name, pipeline, completed, noTimings }) {
  const max = Math.max(completed, noTimings, 1, ...pipeline.map((r) => r.onTrack + r.overdue));
  const row = (label, onTrack, overdue, total, colorClass) => (
    <div key={label} className="grid grid-cols-[140px_1fr_60px] items-center gap-2 mb-1.5">
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
      {pipeline.map((r, i) => row(`${i + 1}. ${r.label}`, r.onTrack, r.overdue, r.onTrack + r.overdue))}
      {row("✅ Completed", 0, 0, completed, COLOR.onTime)}
      {noTimings > 0 && row("No timings set", 0, 0, noTimings, COLOR.none)}
    </div>
  );
}

function StepHealthBlock({ name, stepHealth }) {
  return (
    <div className="mb-3">
      {name && <p className="text-xs font-bold text-gray-500 mb-1.5 border-b border-gray-100 pb-1">{name}</p>}
      {stepHealth.map((s, i) => {
        const total = s.onTime + s.late + s.overdue + s.pending;
        return (
          <div key={i} className="grid grid-cols-[140px_1fr_100px] items-center gap-2 mb-1.5">
            <span className="text-xs text-gray-600 truncate">{i + 1}. {s.label}</span>
            <div className="h-4 bg-gray-100 rounded flex overflow-hidden">
              {total > 0 ? (
                <>
                  {s.onTime > 0 && <div style={{ flex: s.onTime, background: COLOR.onTime }} className="text-white text-[9px] font-bold text-center leading-4" title={`On time: ${s.onTime}`}>{s.onTime}</div>}
                  {s.late > 0 && <div style={{ flex: s.late, background: COLOR.late }} className="text-white text-[9px] font-bold text-center leading-4" title={`Late: ${s.late}`}>{s.late}</div>}
                  {s.overdue > 0 && <div style={{ flex: s.overdue, background: COLOR.overdue }} className="text-white text-[9px] font-bold text-center leading-4" title={`Overdue: ${s.overdue}`}>{s.overdue}</div>}
                  {s.pending > 0 && <div style={{ flex: s.pending, background: COLOR.pending }} className="text-white text-[9px] font-bold text-center leading-4" title={`Running: ${s.pending}`}>{s.pending}</div>}
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

function Donut({ mix, rate }) {
  const segs = [
    { name: "Finished on time", value: mix.onTime, color: COLOR.onTime },
    { name: "Finished late", value: mix.late, color: COLOR.late },
    { name: "Overdue now", value: mix.overdue, color: COLOR.overdue },
    { name: "Running, on track", value: mix.pending, color: COLOR.pending },
  ];
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="text-center text-gray-400 text-sm py-8">No started steps yet.<br />Set the Step Timings, then add a lead.</div>;
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <div className="relative w-40 h-40">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={segs.filter((s) => s.value > 0)} dataKey="value" innerRadius="65%" outerRadius="100%" paddingAngle={2}>
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
          <div key={s.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600">{s.name}</span>
            <b className="ml-auto">{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityChart({ severity }) {
  const any = severity.some((b) => b.late + b.overdue > 0);
  if (!any) return <div className="text-center text-gray-400 text-sm py-8">No delayed steps. 🎉</div>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={severity}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="late" name="Finished late" stackId="a" fill={COLOR.late} />
        <Bar dataKey="overdue" name="Still overdue" stackId="a" fill={COLOR.overdue} />
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

function TeamTable({ team, multi }) {
  if (!team.length) return <div className="text-center text-gray-400 text-sm py-8">No people or leads to show.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100"><th className="py-2">Person</th><th>Leads</th><th>Steps done</th><th>On-time rate</th><th>Late</th><th>Overdue now</th><th>Avg delay</th></tr></thead>
        <tbody>
          {team.map((t) => (
            <tr key={t.name} className="border-b border-gray-50">
              <td className="py-2 font-semibold">{t.name}{!t.unassigned && !t.hasLogin ? <span className="ml-1.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">no login</span> : null}</td>
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

function ListCard({ title, hint, rows, multi, kind }) {
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
                <th className="py-2">Lead</th><th>Step</th><th>Assigned</th><th>Planned</th>
                {kind === "late" ? <><th>Finished</th><th>Late by</th><th>Remark</th></> : <th>Time</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2"><span className="font-semibold">{x.name}</span><br /><small className="text-gray-400">{x.companyName}{multi && x.fms ? ` · ${x.fms}` : ""}</small></td>
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
