import { useCallback, useEffect, useState } from "react";
import { MdFileDownload, MdPictureAsPdf, MdRefresh, MdClose, MdDateRange } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import MonthPicker from "../../components/MonthPicker.jsx";
import CallingReportTable from "../../components/CallingReportTable.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useLiveData } from "../../hooks/useLiveData.js";
import { MONTHS, fmtDate, fromNow } from "../../utils/format.js";
import { exportCSV, exportPDF } from "../../utils/exporters.js";
import { getCallingReport } from "../../services/reportService.js";

// 0 = All Weeks (the month total) — the default; a salesperson only narrows
// to one week when they actually pick it.
const WEEK_OPTIONS = [{ value: 0, label: "All Weeks" }, ...[1, 2, 3, 4].map((w) => ({ value: w, label: `Week ${w}` }))];

// Flat rows for CSV / PDF — one line per (week, salesperson) + a week TOTAL,
// then the Month Total block. One column per Zoom meeting and per Event this
// month — the export stays a full month dump regardless of the on-screen
// week filter.
const flatten = (data) => {
  if (!data) return { columns: [], rows: [] };
  const dyn = [
    ...data.meetings.map((m) => ({ h: `${m.title} — Zoom (${fmtDate(m.scheduledAt)})`, bag: "zooms", key: m.webinarId })),
    ...data.events.map((e) => ({ h: `${e.title} — Event (${fmtDate(e.date)})`, bag: "events", key: e.eventId })),
  ];
  const headers = ["Section", "Name", "Total Leads", "Total Called", ...dyn.map((c) => c.h)];
  const line = (section, name, src) => {
    const r = { Section: section, Name: name, "Total Leads": src.leads ?? 0, "Total Called": src.called ?? 0 };
    dyn.forEach((c) => (r[c.h] = src[c.bag]?.[c.key] ?? 0));
    return r;
  };
  const rows = [];
  for (const wk of [...data.weeks, data.monthTotal]) {
    wk.rows.forEach((r) => rows.push(line(wk.label, r.name, r)));
    rows.push(line(wk.label, "TOTAL", wk.total));
  }
  return { columns: headers.map((k) => ({ key: k, header: k })), rows };
};

export default function CallingReport() {
  const toast = useToast();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [week, setWeek] = useState(0); // All Weeks by default

  // A custom [from, to] someone picked instead of a month — takes over the whole report
  // (no week breakdown; see buildCallingReport). `draft*` is what's in the two date inputs
  // before "Apply"; `range` is the one actually driving the fetch.
  const [range, setRange] = useState(null);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  // Jumping to a different month: back to "All Weeks" instead of leaving a
  // stale week selected from whatever month was open before.
  useEffect(() => {
    setWeek(0);
  }, [period.month, period.year]);

  const applyRange = () => {
    if (!draftFrom || !draftTo) return;
    if (draftFrom > draftTo) return toast.error("The start date must be before the end date.");
    setRange({ from: draftFrom, to: draftTo });
  };
  const clearRange = () => {
    setRange(null);
    setDraftFrom("");
    setDraftTo("");
  };

  // Live: same refresh model as the Sales Report — auto-updates every 20s and
  // on tab focus, no reload.
  const fetchReport = useCallback(() => getCallingReport(range || period), [range, period]);
  const { data, loading, error, refreshedAt, reload } = useLiveData(fetchReport, [
    range?.from,
    range?.to,
    period.month,
    period.year,
  ]);

  const periodLabel = range ? `${fmtDate(range.from)} – ${fmtDate(range.to)}` : `${MONTHS[period.month - 1]} ${period.year}`;
  const fileBase = range
    ? `RBH-calling-report-${range.from}_to_${range.to}`
    : `RBH-calling-report-${period.year}-${String(period.month).padStart(2, "0")}`;

  const doCSV = () => {
    const { columns, rows } = flatten(data);
    exportCSV(`${fileBase}.csv`, columns, rows);
    toast.success("CSV downloaded.");
  };
  const doPDF = () => {
    const { columns, rows } = flatten(data);
    exportPDF({
      filename: `${fileBase}.pdf`,
      title: "RBH Sales CRM — Calling Sales Report",
      subtitle: `${periodLabel} · leads & Zoom attendance per salesperson`,
      columns,
      rows,
    });
    toast.success("PDF downloaded.");
  };

  return (
    <div>
      <PageHeader
        title="Calling Sales Report"
        subtitle="Leads, calling coverage, and Zoom/Event attendance per salesperson — pick a week, or a custom date range, up top."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {!range && (
              <>
                <MonthPicker value={period} onChange={setPeriod} />
                <Listbox className="w-28" value={week} onChange={(v) => setWeek(Number(v))} options={WEEK_OPTIONS} />
              </>
            )}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 rounded-lg pl-2 pr-1 py-1">
              <MdDateRange size={15} className="text-gray-400 shrink-0" />
              <input
                type="date"
                className="bg-transparent text-sm outline-none w-[126px]"
                value={draftFrom}
                max={draftTo || undefined}
                onChange={(e) => setDraftFrom(e.target.value)}
                aria-label="Range start date"
              />
              <span className="text-gray-300 text-xs">to</span>
              <input
                type="date"
                className="bg-transparent text-sm outline-none w-[126px]"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                aria-label="Range end date"
              />
              {range ? (
                <button onClick={clearRange} className="text-gray-400 hover:text-red-500 p-1" title="Clear the date range">
                  <MdClose size={15} />
                </button>
              ) : (
                <Button variant="secondary" size="sm" onClick={applyRange} disabled={!draftFrom || !draftTo}>
                  Apply
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={doCSV} disabled={!data}>
              <MdFileDownload size={16} /> CSV
            </Button>
            <Button variant="secondary" onClick={doPDF} disabled={!data}>
              <MdPictureAsPdf size={16} /> PDF
            </Button>
          </div>
        }
      />

      <Card padding="p-5">
        {loading || !data ? (
          <Spinner />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <p className="text-sm text-gray-500">
                {range ? (
                  <>Showing <b className="text-gray-700">{periodLabel}</b>.</>
                ) : (
                  <>Showing <b className="text-gray-700">{periodLabel}</b>, <b className="text-gray-700">{week === 0 ? "All Weeks" : `Week ${week}`}</b>.</>
                )}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {error ? (
                  <span className="text-amber-600">Couldn't refresh — retrying…</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Live · updated {fromNow(refreshedAt)}
                  </span>
                )}
                <button
                  onClick={reload}
                  className="inline-flex items-center gap-1 text-gray-400 hover:text-primary"
                  title="Refresh now"
                >
                  <MdRefresh size={15} />
                </button>
              </div>
            </div>
            <CallingReportTable data={data} week={range ? 0 : week} />
          </>
        )}
      </Card>
    </div>
  );
}
