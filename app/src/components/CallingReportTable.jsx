import { fmtDate } from "../utils/format.js";

// "Calling Sales Report" — one row per salesperson for whichever week is
// picked up top (the Week filter, next to the month picker). Zoom AND Event
// columns are dynamic — one per non-cancelled Zoom meeting / Event this
// month, in date order.

export function currentWeekOfMonth(month, year) {
  const now = new Date();
  if (year > now.getFullYear() || (year === now.getFullYear() && month - 1 > now.getMonth())) return 0;
  if (year < now.getFullYear() || (year === now.getFullYear() && month - 1 < now.getMonth())) return 5;
  return Math.min(4, Math.ceil(now.getDate() / 7));
}

export default function CallingReportTable({ data, week }) {
  if (!data) return null;
  const { meetings, events, weeks, monthTotal } = data;
  const now = new Date();
  const curWeek = currentWeekOfMonth(data.month, data.year);
  const future = week > 0 && week > curWeek;

  // Dynamic middle columns — one per Zoom meeting and one per Event this
  // month, merged into a single date-ordered timeline.
  const dynCols = [
    ...meetings.map((m) => ({ key: m.webinarId, bag: "zooms", kind: "Zoom", title: m.title, when: m.scheduledAt })),
    ...events.map((e) => ({ key: e.eventId, bag: "events", kind: "Event", title: e.title, when: e.date })),
  ].sort((a, b) => new Date(a.when) - new Date(b.when));

  const selectedWeek = week === 0 ? monthTotal : weeks.find((w) => w.week === week) || monthTotal;

  const numCells = (c, isTotal) => (
    <>
      <td className={numCls(isTotal)}>{c.leads}</td>
      <td className={numCls(isTotal)}>{c.called}</td>
      {dynCols.map((col) => (
        <td key={col.key} className={numCls(isTotal)}>
          {c[col.bag][col.key]}
        </td>
      ))}
    </>
  );

  // Mobile: this table can run to a dozen+ columns once a busy month's Zoom
  // meetings and Events are all in the mix — even with a sticky first
  // column, that's an unreasonable amount of side-scrolling on a phone. One
  // card per salesperson, metrics stacked, reads the same numbers without
  // it. Desktop/tablet (the admin-facing report view) keeps the original
  // grid untouched below.
  const metricRow = (label, value, hint, key, bold = false) => (
    <div key={key} className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="min-w-0 text-slate-500">
        <span className={`block truncate ${bold ? "font-bold text-slate-700" : ""}`}>{label}</span>
        {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
      </span>
      <span className={`shrink-0 tabular-nums ${bold ? "font-extrabold text-slate-900" : "font-semibold text-slate-800"}`}>
        {value}
      </span>
    </div>
  );

  const dynHint = (col) => `${fmtDate(col.when)} · ${col.kind} · ${new Date(col.when) > now ? "upcoming" : "attended"}`;

  return (
    <div>
      <div className="sm:hidden space-y-3">
        {selectedWeek.rows.map((r) => (
          <div key={r.salespersonId} className="rounded-xl border-2 border-slate-300 overflow-hidden bg-white">
            <div className="bg-slate-700 text-white px-3 py-2 font-bold text-sm">{r.name}</div>
            <div className="divide-y divide-slate-100 text-sm">
              {metricRow("Total Leads", r.leads, 'added', "leads")}
              {metricRow("Total Called", r.called, 'off "New"', "called")}
              {dynCols.map((col) => metricRow(col.title, r[col.bag][col.key], dynHint(col), col.key))}
            </div>
          </div>
        ))}
        <div
          className={`rounded-xl border-2 border-slate-400 overflow-hidden ${future ? "bg-slate-50" : "bg-slate-100"}`}
        >
          <div className="px-3 py-2 font-extrabold uppercase text-xs text-slate-600">Total</div>
          <div className="divide-y divide-slate-200 text-sm">
            {metricRow("Total Leads", selectedWeek.total.leads, null, "t-leads", true)}
            {metricRow("Total Called", selectedWeek.total.called, null, "t-called", true)}
            {dynCols.map((col) => metricRow(col.title, selectedWeek.total[col.bag][col.key], null, col.key, true))}
          </div>
        </div>
        {dynCols.length === 0 && (
          <p className="text-xs text-gray-500 px-1">No Zoom meeting or Event is scheduled this month yet.</p>
        )}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[720px] rounded-xl border-2 border-slate-400 overflow-hidden">
          <table className="w-full text-[15px] border-separate border-spacing-0">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-white bg-slate-700">
                <th className="px-3 py-3 text-left font-bold border-r border-slate-500 sticky left-0 z-[2] bg-slate-700">
                  Salesperson
                </th>
                <th className="px-3 py-3 text-right font-bold border-l border-slate-500 leading-tight">
                  Total Leads<span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">added</span>
                </th>
                <th className="px-3 py-3 text-right font-bold border-l border-slate-500 leading-tight">
                  Total Called<span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">off "New"</span>
                </th>
                {dynCols.map((col) => {
                  const upcoming = new Date(col.when) > now;
                  return (
                    <th
                      key={col.key}
                      className="px-3 py-3 text-right font-bold border-l border-slate-500 leading-tight"
                    >
                      {col.title}
                      <span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">
                        {fmtDate(col.when)} · {col.kind} · {upcoming ? "upcoming" : "attended"}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {selectedWeek.rows.map((r) => (
                <tr key={r.salespersonId} className="group border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-700 border-r-2 border-slate-300 bg-white sticky left-0 z-[1] group-hover:bg-slate-50">
                    {r.name}
                  </td>
                  {numCells(r)}
                </tr>
              ))}
              <tr className={future ? "bg-slate-50" : "bg-slate-100"}>
                <td
                  className={`px-3 py-2.5 text-[13px] font-extrabold uppercase text-slate-600 border-r-2 border-slate-300 border-t border-slate-200 sticky left-0 z-[1] ${
                    future ? "bg-slate-50" : "bg-slate-100"
                  }`}
                >
                  Total
                </td>
                {numCells(selectedWeek.total, true)}
              </tr>
            </tbody>
          </table>
        </div>
        {dynCols.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 px-1">No Zoom meeting or Event is scheduled this month yet.</p>
        )}
      </div>
    </div>
  );
}

const numCls = (isTotal) =>
  `px-3 py-2.5 text-right tabular-nums border-t border-l border-slate-200 ${
    isTotal ? "text-slate-900 font-bold" : "text-slate-800"
  }`;
