import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  MdAdd,
  MdViewKanban,
  MdTableRows,
  MdSearch,
  MdClose,
  MdArrowBack,
  MdPhone,
  MdPhoneMissed,
  MdChevronRight,
  MdExpandMore,
  MdManageSearch,
  MdOutlineGroupAdd,
  MdOutlineFileDownload,
  MdOutlineFileUpload,
  MdOutlinePictureAsPdf,
  MdOutlineTableChart,
} from "react-icons/md";
import Card from "../../components/ui/Card.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/DataTable.jsx";
import MultiSelect from "../../components/ui/MultiSelect.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import KanbanBoard from "../../components/kanban/KanbanBoard.jsx";
import LeadStageSelect from "../../components/LeadStageSelect.jsx";
import SalespersonPicker from "../../components/SalespersonPicker.jsx";
import LeadFormModal from "./LeadFormModal.jsx";
import ImportLeadsModal from "./ImportLeadsModal.jsx";
import IfoFormModal from "../ifo/IfoFormModal.jsx";
import StatusChangeModal from "./StatusChangeModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import PeriodFilter, { periodRange } from "../../components/PeriodFilter.jsx";
import { LEAD_STATUS, LEAD_STATUS_ORDER, LEAD_SOURCE, optionsFrom, moveBlocked } from "../../utils/constants.js";
import { fmtDate, fromNow, inrCompact, pct } from "../../utils/format.js";
import { exportCSV, exportPDF } from "../../utils/exporters.js";
import { getAssignable } from "../../services/userService.js";
import {
  listLeads,
  getKanban,
  getKanbanColumn,
  getPipeline,
  undoLeadStatus,
} from "../../services/leadService.js";

// `status/source/q` have UI controls; the rest are drill-down filters set only
// by a dashboard tile link (?from=…&status=… etc.) and shown as a banner.
// status/source/assignedTo are multi-select — held as arrays, serialized to
// the URL/API as a comma-joined string (see cleanParams / the URL-sync effect).
const MULTI_KEYS = ["status", "source", "assignedTo"];
const emptyFilters = { status: [], source: [], q: "", from: "", to: "", open: "", followup: "", cnp: "", assignedTo: [] };
const DRILL_KEYS = ["from", "to", "open", "followup", "cnp", "assignedTo"];
const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : !!v);

// Cards pulled per fetch as a column auto-fills on scroll. Bigger than the
// backend's first-paint `perColumn` (60) so a huge stage cascades in with a
// handful of requests, not dozens.
const KANBAN_PAGE = 200;

// One pill in the stage strip above the table. `partial` = this stage is
// part of a multi-stage selection made from the Stage dropdown.
function StageTab({ active, partial, label, count, dot, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
        active
          ? "border-primary bg-white text-gray-900 shadow-card ring-1 ring-primary/15"
          : partial
          ? "border-primary/40 bg-primary-light/40 text-gray-900"
          : "border-gray-200 bg-white/70 text-gray-600 hover:border-gray-300 hover:bg-white hover:text-gray-900"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      <span
        className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${
          active ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
        }`}
      >
        {count == null ? "–" : count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}

// A removable "Stage: New ×" chip in the active-filters row.
function FilterChip({ prefix, label, dot, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1 pl-2.5 pr-1 text-xs shadow-xs">
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      <span className="text-gray-500">{prefix}:</span>
      <span className="max-w-[180px] truncate font-semibold text-gray-900">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${prefix} filter`}
        className="rounded-full p-0.5 text-gray-400 transition-colors hover:bg-primary-light hover:text-primary"
      >
        <MdClose size={13} />
      </button>
    </span>
  );
}

// "Export ▾" — one button instead of separate CSV/PDF buttons crowding the
// header. Exports every lead matching the current filters, not just the page.
function ExportMenu({ onExport, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = (fmt, Icon, iconClass, title, hint) => (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        onExport(fmt);
      }}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon size={18} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} disabled={busy} aria-expanded={open}>
        <MdOutlineFileDownload size={17} /> {busy ? "Exporting…" : "Export"}
        <MdExpandMore size={16} className={`-mr-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-modal ring-1 ring-black/5 animate-fade-in">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Export filtered leads
          </p>
          {item("csv", MdOutlineTableChart, "bg-emerald-50 text-emerald-700", "Excel / CSV", "Open in Excel or Google Sheets")}
          {item("pdf", MdOutlinePictureAsPdf, "bg-primary-light text-primary", "PDF report", "Print-ready, branded summary")}
        </div>
      )}
    </div>
  );
}

export default function LeadsBoard() {
  const nav = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const { user } = useAuth();
  const canPickOwner = user?.role === "admin" || user?.role === "manager";
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => {
    const f = { ...emptyFilters };
    for (const k of Object.keys(emptyFilters)) {
      const v = searchParams.get(k);
      if (!v) continue;
      f[k] = MULTI_KEYS.includes(k) ? v.split(",").filter(Boolean) : v;
    }
    return f;
  });
  // Captured once at mount — the URL-sync effect below wipes location.state.
  const [cameFromDrilldown] = useState(
    () =>
      location.state?.from === "dashboard" ||
      [...DRILL_KEYS, "status"].some((k) => searchParams.get(k))
  );
  // Table by default everywhere — Kanban's drag-and-drop is native HTML5
  // DnD, which touchscreens (iOS Safari, Android Chrome) never fire drag
  // events for, and LeadStageSelect's tap dropdown (Table view) moves a
  // lead through stages the same way a drag would, without that gap. Board
  // is still one click away via the toggle for anyone who wants it — that
  // choice is remembered from then on.
  // _v2: anyone with "kanban" already saved under the old key gets the new
  // Table default too, instead of staying stuck on their old one.
  const [view, setView] = useState(() => {
    if (cameFromDrilldown) return "table";
    return localStorage.getItem("rbh_leads_view_v2") || "table";
  });
  // Defaults to "All time" — a bulk import or an old lead with a backdated
  // "Created on" would otherwise silently sit outside "This month" and look
  // deleted/missing (see handleImportSaved below for the same reasoning).
  // Ignored while a dashboard drill-down is active.
  // _v2: anyone with the old "This month" default already cached under the
  // v1 key gets the new default too, instead of being stuck on their old one.
  const [period, setPeriod] = useState(() => localStorage.getItem("rbh_leads_period_v2") || "all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [kanban, setKanban] = useState({});
  const [loadingCols, setLoadingCols] = useState({});
  const colInFlight = useRef({}); // synchronous guard against a double-fire loading the same page twice
  const [table, setTable] = useState({ data: [], total: 0, page: 1, pages: 1 });
  const [convertLead, setConvertLead] = useState(null);
  const [statusChange, setStatusChange] = useState(null); // { lead, toStatus }
  const [people, setPeople] = useState([]);
  const [exporting, setExporting] = useState(false);
  // Per-stage counts for the stage strip — every active filter EXCEPT stage
  // itself, so each tab shows how many leads it would narrow down to.
  const [stageCounts, setStageCounts] = useState(null);

  // The owner picker is admin/manager only — a salesperson only ever has
  // their own leads to export, so there's nothing for them to pick.
  useEffect(() => {
    if (!canPickOwner) return;
    getAssignable()
      .then((rows) => setPeople(rows.filter((u) => u.role === "salesperson")))
      .catch(() => {});
  }, [canPickOwner]);

  // A dashboard drill-down brings its own scope (?from/?to/?open/?followup);
  // otherwise the month/period slicer applies.
  const scoped = !!(filters.from || filters.to || filters.open || filters.followup || filters.cnp);

  const cleanParams = useCallback(() => {
    const p = {};
    for (const [k, v] of Object.entries(filters)) {
      if (!hasValue(v)) continue;
      p[k] = MULTI_KEYS.includes(k) ? v.join(",") : v;
    }
    if (!p.from && !p.to && !p.open && !p.followup) {
      if (period === "custom") {
        if (customFrom) p.from = customFrom;
        if (customTo) p.to = customTo;
      } else if (period !== "all") {
        const r = periodRange(period);
        if (r.from) p.from = r.from;
        if (r.to) p.to = r.to;
      }
    }
    return p;
  }, [filters, period, customFrom, customTo]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (view === "kanban") {
        const { columns } = await getKanban(cleanParams());
        setKanban(columns);
      } else {
        setTable(await listLeads({ ...cleanParams(), page, limit: 20 }));
      }
    } catch (err) {
      if (!silent) toast.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [view, page, cleanParams, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // After data loads, scroll to the lead the user was on before navigating away.
  useEffect(() => {
    if (!table.data.length) return;
    const id = sessionStorage.getItem("rbh_scroll_to_lead");
    if (!id) return;
    sessionStorage.removeItem("rbh_scroll_to_lead");
    setTimeout(() => {
      document.getElementById(`lead-row-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }, [table.data]);

  // Refreshed whenever the table itself reloads (filter change, real-time
  // sync, a save) rather than on every filter keystroke separately.
  useEffect(() => {
    if (view !== "table") return;
    const p = cleanParams();
    delete p.status;
    let alive = true;
    getPipeline(p)
      .then((rows) => alive && setStageCounts(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, table]);

  // Real-time: another salesperson's move, a new lead, or a conversion shows
  // up here without a manual refresh. Silent — no spinner flash, matches the
  // background-refresh pattern the report pages already use. Note this does
  // reset any deep column pagination the viewer had scrolled into, same
  // trade-off the periodic report refreshes already make.
  useEffect(() => {
    const onSync = (e) => {
      const changed = e.detail?.topics || [];
      if (changed.some((t) => ["leads", "conversions"].includes(t))) load(true);
    };
    window.addEventListener("crm:sync", onSync);
    return () => window.removeEventListener("crm:sync", onSync);
  }, [load]);

  useEffect(() => localStorage.setItem("rbh_leads_view_v2", view), [view]);
  useEffect(() => localStorage.setItem("rbh_leads_period_v2", period), [period]);

  // Keep the URL in step with the active filters + current page — shareable,
  // back-button safe. Page > 1 is written as ?page=N; page 1 is omitted to
  // keep the URL clean. Only write when something actually changed.
  useEffect(() => {
    const next = {};
    for (const [k, v] of Object.entries(filters)) {
      if (!hasValue(v)) continue;
      next[k] = MULTI_KEYS.includes(k) ? v.join(",") : v;
    }
    if (page > 1) next.page = String(page);
    const allKeys = [...searchParams.keys()];
    const same =
      Object.keys(next).length === allKeys.length &&
      Object.entries(next).every(([k, v]) => searchParams.get(k) === v);
    if (!same) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const setFilter = (patch) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const clearDrill = () => setFilters((f) => ({ ...f, from: "", to: "", open: "", followup: "", cnp: "" }));
  const clearAll = () => {
    setPage(1);
    setFilters(emptyFilters);
    setPeriod("all");
    setCustomFrom("");
    setCustomTo("");
  };

  // A bulk import's "Created on" column deliberately backdates leads to their
  // real historical date (that's the whole point — migrated data keeps its
  // real age). But the board defaults to "This month", so an import full of
  // older dates would finish successfully and then look like it silently
  // lost leads. Reset to "All time" (and clear any stage/source/search
  // filter — imports always land as stage "new", source "other") so
  // everything just imported is actually visible right after.
  const handleImportSaved = () => {
    setPeriod("all");
    setFilters(emptyFilters);
    setPage(1);
  };

  // Dashboard drill-downs (date window / open pipeline / follow-up due) —
  // owner, stage, source and search show as removable chips instead.
  const drillActive = scoped;
  const drillLabel = [
    filters.from || filters.to
      ? `Added ${filters.from ? fmtDate(filters.from) : "…"} – ${filters.to ? fmtDate(filters.to) : "…"}`
      : null,
    filters.followup === "due" ? "Follow-up due" : null,
    filters.open === "1" ? "Open pipeline" : null,
    filters.cnp === "1" ? "Call Not Picked" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const personName = (id) => people.find((p) => p._id === id)?.name || "Salesperson";
  const chips = [
    filters.q && { key: "q", prefix: "Search", label: `“${filters.q}”`, onRemove: () => setFilter({ q: "" }) },
    ...filters.assignedTo.map((id) => ({
      key: `as-${id}`,
      prefix: "Owner",
      label: personName(id),
      onRemove: () => setFilter({ assignedTo: filters.assignedTo.filter((x) => x !== id) }),
    })),
    ...filters.status.map((s) => ({
      key: `st-${s}`,
      prefix: "Stage",
      label: LEAD_STATUS[s]?.label || s,
      dot: LEAD_STATUS[s]?.dot,
      onRemove: () => setFilter({ status: filters.status.filter((x) => x !== s) }),
    })),
    ...filters.source.map((s) => ({
      key: `so-${s}`,
      prefix: "Source",
      label: LEAD_SOURCE[s]?.label || s,
      onRemove: () => setFilter({ source: filters.source.filter((x) => x !== s) }),
    })),
  ].filter(Boolean);
  const hasFilters = chips.length > 0 || drillActive;

  const findLead = (id) =>
    Object.values(kanban)
      .flatMap((c) => c.items || [])
      .find((l) => l._id === id);

  // Leads move forward-only (every role) — bounce a backward drag/drop before
  // the prompt opens.
  // Every drag opens a small prompt for an (optional) remark + next follow-up
  // date before the stage actually changes.
  const onMove = (id, status) => {
    const lead = findLead(id);
    if (!lead || lead.status === status) return;
    const blocked = moveBlocked(lead.status, status, lead.statusHistory);
    if (blocked) return toast.error(blocked);
    setStatusChange({ lead, toStatus: status });
  };

  // Dragging onto "Converted" opens the record-conversion flow instead — the
  // salesperson must enter how much was paid.
  const onConvert = (id) => {
    const lead = findLead(id);
    if (lead) setConvertLead(lead);
  };

  // Table view: the Stage cell is an inline dropdown. Picking a stage runs the
  // same flow as a Kanban drag — → Converted opens the conversion form, every
  // other move opens the remark / follow-up / session-picker modal.
  const onPickStage = (lead, toStatus) => {
    const blocked = moveBlocked(lead.status, toStatus, lead.statusHistory);
    if (blocked) return toast.error(blocked);
    if (toStatus === "converted") setConvertLead(lead);
    else setStatusChange({ lead, toStatus });
  };

  // One-step undo of a card's last move — straight from the board.
  const onUndo = async (lead) => {
    const hist = lead.statusHistory || [];
    const prev = hist.length >= 2 ? hist[hist.length - 2].status : null;
    if (!prev) return;
    try {
      await undoLeadStatus(lead._id);
      applyLocalMove(lead._id, prev, { statusRevertable: false });
      toast.success(`Moved back to ${LEAD_STATUS[prev]?.label || prev}.`);
    } catch (err) {
      toast.error(err);
    }
  };

  // Pull the next page of one column from the API and append it — keeps the
  // board light no matter how many leads a stage holds.
  const loadMoreColumn = useCallback(
    async (status) => {
      const col = kanban[status];
      if (!col || col.items.length >= col.total || colInFlight.current[status]) return;
      colInFlight.current[status] = true;
      setLoadingCols((m) => ({ ...m, [status]: true }));
      try {
        const res = await getKanbanColumn({
          ...cleanParams(),
          col: status,
          skip: col.items.length,
          limit: KANBAN_PAGE,
        });
        setKanban((prev) => {
          const cur = prev[status] || { items: [], total: 0 };
          const seen = new Set(cur.items.map((l) => l._id));
          const fresh = (res.items || []).filter((l) => !seen.has(l._id));
          const items = [...cur.items, ...fresh];
          // If a page brought nothing new, we've hit the real end — cap the
          // total so the auto-loader stops (guards against a count/find drift).
          const total = fresh.length === 0 ? items.length : res.total ?? cur.total;
          return { ...prev, [status]: { items, total } };
        });
      } catch (err) {
        toast.error(err);
      } finally {
        colInFlight.current[status] = false;
        setLoadingCols((m) => ({ ...m, [status]: false }));
      }
    },
    [kanban, cleanParams, toast]
  );

  // After a drag succeeds, move the card between columns in place instead of
  // refetching the whole board — so a deep scroll position isn't lost.
  const applyLocalMove = (leadId, toStatus, patch = {}) => {
    setKanban((prev) => {
      let moved;
      const next = {};
      for (const [s, col] of Object.entries(prev)) {
        const items = col.items || [];
        const idx = items.findIndex((l) => l._id === leadId);
        if (idx === -1) {
          next[s] = col;
        } else {
          moved = { ...items[idx], status: toStatus, ...patch };
          // Left "Converted"? the conversion is gone server-side — drop the
          // money fields so the card doesn't keep showing a green deal value.
          if (s === "converted" && toStatus !== "converted") {
            moved.dealValue = undefined;
            moved.amountReceived = undefined;
            moved.conversionId = undefined;
          }
          next[s] = { items: items.filter((_, i) => i !== idx), total: Math.max(0, (col.total || 1) - 1) };
        }
      }
      if (moved) {
        const dst = next[toStatus] || prev[toStatus] || { items: [], total: 0 };
        next[toStatus] = { items: [moved, ...dst.items], total: (dst.total || 0) + 1 };
      }
      return next;
    });
  };

  const ViewToggle = (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-xs" role="tablist" aria-label="Leads view">
      {[
        ["table", "Table", MdTableRows],
        ["kanban", "Board", MdViewKanban],
      ].map(([key, label, Icon]) => (
        <button
          key={key}
          role="tab"
          aria-selected={view === key}
          onClick={() => setView(key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${
            view === key ? "bg-primary-light text-primary-dark" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Icon size={16} className={view === key ? "text-primary" : ""} /> {label}
        </button>
      ))}
    </div>
  );

  const columns = [
    {
      key: "name",
      header: "Lead",
      render: (l) => (
        <div
          className="flex items-center gap-3 min-w-[200px]"
          title={
            l.latestRemark?.text
              ? `Latest remark (${fromNow(l.latestRemark.at)}):\n${l.latestRemark.text}`
              : "No remarks yet"
          }
        >
          <Avatar name={l.name} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate group-hover:text-primary-dark transition-colors">
              {l.name}
            </p>
            <p className="text-xs text-gray-500 truncate tabular-nums">
              {l.restaurantName ? `${l.restaurantName} · ${l.phone}` : l.phone}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Stage",
      render: (l) => (
        <div className="flex flex-col gap-1">
          <LeadStageSelect lead={l} onPick={onPickStage} />
          {l.callNotPicked && (
            <span className="inline-flex items-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700 w-fit">
              <MdPhoneMissed size={11} /> Not picked
            </span>
          )}
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      hideOnMobile: true,
      render: (l) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
          {LEAD_SOURCE[l.source]?.label || l.source || "—"}
        </span>
      ),
    },
    { key: "city", header: "City", hideOnMobile: true, render: (l) => l.city || "—" },
    {
      key: "assignedTo",
      header: "Owner",
      hideOnMobile: true,
      render: (l) =>
        l.assignedTo?.name ? (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <Avatar name={l.assignedTo.name} size="xs" />
            <span className="text-gray-800">{l.assignedTo.name}</span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "potentialValue",
      header: "Value",
      align: "right",
      render: (l) => {
        const won = l.status === "converted" && l.dealValue != null;
        const amount = won ? l.dealValue : l.potentialValue;
        if (!amount) return "—";
        const unpaid = won && l.amountReceived != null && l.amountReceived < l.dealValue;
        return (
          <span
            className={won ? "text-green-600 font-semibold" : "text-gray-600"}
            title={won ? "Confirmed deal value" : "Estimated potential"}
          >
            {inrCompact(amount)}
            {unpaid && (
              <span
                className={`block text-[11px] font-normal ${
                  l.amountReceived === 0 ? "text-red-500" : "text-amber-600"
                }`}
              >
                {l.amountReceived === 0 ? "unpaid" : `${pct(l.amountReceived, l.dealValue)}% paid`}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "Added",
      hideOnMobile: true,
      render: (l) => (
        <div className="whitespace-nowrap">
          <p className="text-gray-800">{fmtDate(l.createdAt)}</p>
          <p className="text-xs text-gray-500">{fromNow(l.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div className="flex items-center justify-end gap-1">
          {l.phone && (
            <a
              href={`tel:${l.phone}`}
              onClick={(e) => e.stopPropagation()}
              title={`Call ${l.phone}`}
              aria-label={`Call ${l.name}`}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              <MdPhone size={16} />
            </a>
          )}
          <span className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400 transition-colors group-hover:bg-primary-light group-hover:text-primary">
            <MdChevronRight size={20} />
          </span>
        </div>
      ),
    },
  ];

  const exportCols = [
    "Lead", "Phone", "Brand", "City", "State", "Stage", "Source", "Owner", "Value", "Next follow-up", "Added",
  ].map((k) => ({ key: k, header: k }));
  const toExportRow = (l) => ({
    Lead: l.name,
    Phone: l.phone,
    Brand: l.restaurantName || "—",
    City: l.city || "—",
    State: l.state || "—",
    Stage: LEAD_STATUS[l.status]?.label || l.status,
    Source: LEAD_SOURCE[l.source]?.label || l.source,
    Owner: l.assignedTo?.name || "—",
    Value: l.status === "converted" && l.dealValue != null ? l.dealValue : l.potentialValue || 0,
    "Next follow-up": l.nextFollowUpDate ? fmtDate(l.nextFollowUpDate) : "—",
    Added: fmtDate(l.createdAt),
  });
  // Pulls every lead matching the current filters (not just the page on
  // screen) — a salesperson only ever has their own leads in scope here, an
  // admin/manager gets everyone's unless they've picked one salesperson above.
  const fetchAllForExport = async () => {
    const base = cleanParams();
    let page = 1;
    let all = [];
    while (true) {
      const res = await listLeads({ ...base, page, limit: 100 });
      all = all.concat(res.data);
      if (page >= res.pages || !res.data.length) break;
      page++;
    }
    return all;
  };
  const exportLabel = () => {
    if (filters.assignedTo.length === 1) {
      const owner = people.find((p) => p._id === filters.assignedTo[0]);
      if (owner) return owner.name;
    }
    if (filters.assignedTo.length > 1) return `${filters.assignedTo.length}-people`;
    return "all";
  };
  const doExport = async (fmt) => {
    setExporting(true);
    try {
      const rows = await fetchAllForExport();
      if (!rows.length) return toast.error("No leads match the current filters.");
      const exportRows = rows.map(toExportRow);
      const base = `RBH-leads-${exportLabel().replace(/\s+/g, "-")}`;
      if (fmt === "csv") {
        exportCSV(`${base}.csv`, exportCols, exportRows);
      } else {
        exportPDF({
          filename: `${base}.pdf`,
          title: "RBH Sales CRM — Leads",
          subtitle: `${rows.length} lead${rows.length === 1 ? "" : "s"} · ${exportLabel()}`,
          columns: exportCols,
          rows: exportRows,
        });
      }
      toast.success(`${fmt.toUpperCase()} downloaded.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  const goBack = () => (window.history.state?.idx > 0 ? nav(-1) : nav("/dashboard"));

  const resultCount = loading
    ? null
    : view === "table"
    ? table.total
    : Object.values(kanban).reduce((s, c) => s + (c.total || 0), 0);

  return (
    <div>
      {cameFromDrilldown && (
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <MdArrowBack size={16} /> Back
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Sales pipeline</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-gray-900 leading-tight">Leads</h1>
            {resultCount != null && (
              <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
                {resultCount.toLocaleString("en-IN")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Every lead from first contact to IFO conversion — filter, act and follow up in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ViewToggle}
          <ExportMenu onExport={doExport} busy={exporting} />
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <MdOutlineFileUpload size={17} /> Import
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <MdAdd size={18} /> New lead
          </Button>
        </div>
      </div>

      {/* Stage strip — one-click focus on a single stage, with live counts */}
      {view === "table" && (
        <div className="-mx-1 mb-4 overflow-x-auto">
          <div className="flex min-w-max gap-2 px-1 pb-1">
            <StageTab
              active={filters.status.length === 0}
              label="All leads"
              count={stageCounts ? stageCounts.reduce((s, r) => s + r.count, 0) : null}
              onClick={() => setFilter({ status: [] })}
            />
            {LEAD_STATUS_ORDER.map((s) => {
              const only = filters.status.length === 1 && filters.status[0] === s;
              return (
                <StageTab
                  key={s}
                  active={only}
                  partial={!only && filters.status.includes(s)}
                  dot={LEAD_STATUS[s].dot}
                  label={LEAD_STATUS[s].label}
                  count={stageCounts?.find((r) => r.status === s)?.count ?? null}
                  onClick={() => setFilter({ status: only ? [] : [s] })}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <Card padding="p-0" className="mb-4">
        <div className="flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-md">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
            <input
              placeholder="Search name, phone, brand or city…"
              value={filters.q}
              onChange={(e) => setFilter({ q: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-gray-50/70 pl-10 pr-9 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow,background-color] duration-150 hover:border-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {filters.q && (
              <button
                onClick={() => setFilter({ q: "" })}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <MdClose size={16} />
              </button>
            )}
          </div>
          <div
            className={`grid grid-cols-2 gap-2 max-md:[&>*:last-child:nth-child(odd)]:col-span-2 xl:ml-auto xl:flex xl:items-center ${
              [!scoped, canPickOwner, true, true].filter(Boolean).length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"
            }`}
          >
            {!scoped && (
              <PeriodFilter
                label="Period"
                className="xl:w-[190px]"
                value={period}
                onChange={(k) => {
                  setPeriod(k);
                  setCustomFrom("");
                  setCustomTo("");
                  setPage(1);
                }}
              />
            )}
            {!scoped && period === "custom" && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary xl:w-[150px]"
                  title="From date"
                />
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary xl:w-[150px]"
                  title="To date"
                />
              </>
            )}
            {canPickOwner && (
              <SalespersonPicker
                label="Owner"
                className="xl:w-[190px]"
                value={filters.assignedTo}
                onChange={(v) => setFilter({ assignedTo: v })}
                people={people}
              />
            )}
            <MultiSelect
              label="Stage"
              className="xl:w-[190px]"
              value={filters.status}
              onChange={(v) => setFilter({ status: v })}
              options={optionsFrom(LEAD_STATUS).map((o) => ({ ...o, dot: LEAD_STATUS[o.value].dot }))}
            />
            <MultiSelect
              label="Source"
              className="xl:w-[170px]"
              value={filters.source}
              onChange={(v) => setFilter({ source: v })}
              options={optionsFrom(LEAD_SOURCE)}
            />
            <button
              onClick={() => setFilter({ cnp: filters.cnp === "1" ? "" : "1" })}
              title="Show only leads where the call was not picked up"
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap xl:w-auto ${
                filters.cnp === "1"
                  ? "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <MdPhoneMissed size={16} />
              <span className="hidden sm:inline">Call Not Picked</span>
            </button>
          </div>
        </div>

        {(chips.length > 0 || drillActive) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/50 px-3 py-2.5 sm:px-4 rounded-b-xl">
            <span className="mr-1 text-xs font-semibold text-gray-500">Filtered by</span>
            {drillActive && (
              <FilterChip prefix="From dashboard" label={drillLabel || "filtered"} onRemove={clearDrill} />
            )}
            {chips.map((c) => (
              <FilterChip key={c.key} prefix={c.prefix} label={c.label} dot={c.dot} onRemove={c.onRemove} />
            ))}
            <button
              onClick={clearAll}
              className="ml-1 text-xs font-semibold text-primary hover:text-primary-dark hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </Card>

      {view === "kanban" ? (
        loading ? (
          <Spinner />
        ) : (
          <KanbanBoard
            columns={kanban}
            onMove={onMove}
            onConvert={onConvert}
            onCardClick={(l) => nav(`/leads/${l._id}`)}
            onUndo={onUndo}
            onLoadMore={loadMoreColumn}
            loadingCols={loadingCols}
          />
        )
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={table.data}
            loading={loading}
            skeletonRows={8}
            rowId={(l) => `lead-row-${l._id}`}
            onRowClick={(l) => { sessionStorage.setItem("rbh_scroll_to_lead", l._id); nav(`/leads/${l._id}`); }}
            empty={
              hasFilters ? (
                <EmptyState
                  icon={MdManageSearch}
                  title="No leads match these filters"
                  message="Try removing a filter, widening the period, or searching for something else."
                  action={
                    <Button variant="secondary" onClick={clearAll}>
                      Clear all filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={MdOutlineGroupAdd}
                  title={period === "all" ? "No leads yet" : "No leads in this period"}
                  message={
                    period === "all"
                      ? "Add your first lead, or import a list from Excel / CSV to get started."
                      : "Nothing was added in this window. Switch the period to “All time” to see older leads."
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setFormOpen(true)}>
                        <MdAdd size={18} /> New lead
                      </Button>
                      <Button variant="secondary" onClick={() => setImportOpen(true)}>
                        <MdOutlineFileUpload size={17} /> Import
                      </Button>
                    </div>
                  }
                />
              )
            }
          />
          {table.pages > 1 && (
            <div className="border-t border-gray-100 px-4">
              <Pagination
                page={table.page}
                pages={table.pages}
                total={table.total}
                onChange={setPage}
                noun="leads"
              />
            </div>
          )}
        </Card>
      )}

      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={handleImportSaved} />
      <IfoFormModal
        open={!!convertLead}
        onClose={() => setConvertLead(null)}
        onSaved={load}
        presetLead={convertLead}
      />
      <StatusChangeModal
        open={!!statusChange}
        lead={statusChange?.lead}
        toStatus={statusChange?.toStatus}
        onClose={() => setStatusChange(null)}
        onDone={() => {
          if (!statusChange) return;
          // Board: move the card in place so a deep scroll survives. Table:
          // just refetch — a filtered row may now belong elsewhere.
          if (view === "kanban") {
            const now = new Date().toISOString();
            const { lead, toStatus } = statusChange;
            applyLocalMove(lead._id, toStatus, {
              // so the card shows "Undo" right away
              statusRevertable: true,
              statusChangedAt: now,
              statusHistory: [...(lead.statusHistory || []), { status: toStatus, at: now }],
            });
          } else load();
        }}
      />
    </div>
  );
}
