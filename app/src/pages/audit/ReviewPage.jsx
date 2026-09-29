import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdUndo, MdErrorOutline, MdOpenInNew, MdWarningAmber } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Tabs from "../../components/ui/Tabs.jsx";
import DataTable from "../../components/DataTable.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import PeriodFilter, { periodRange } from "../../components/PeriodFilter.jsx";
import useConversionTypes from "../../hooks/useConversionTypes.js";
import { useLiveData } from "../../hooks/useLiveData.js";
import { fmtDateTime, fromNow, inr, inrCompact } from "../../utils/format.js";
import { listReversals, listMistakes } from "../../services/auditService.js";

// Admin/manager-only oversight of two things that are easy to miss buried in
// individual lead timelines: someone backing out a change (a stage undo, or
// a manager reversing a whole conversion), and a conversion recorded with ₹0
// received — often just a forgotten payment entry, not a real ₹0 sale.
// Neither is a new log — both are already-written data, just surfaced here
// company-wide instead of one lead at a time.
export default function ReviewPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState("reversals");
  // Defaults to "All time" (unlike most other lists) — a mistake made two
  // months ago is exactly the kind of thing "This month" would hide, and
  // that's the last thing a review page should do.
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const { byCode: typesByCode } = useConversionTypes();
  const pr = periodRange(period);

  useEffect(() => setPage(1), [tab, period]);

  const fetchReversals = useCallback(
    () => listReversals({ page, limit: 20, from: pr.from, to: pr.to }),
    [page, pr.from, pr.to]
  );
  const fetchMistakes = useCallback(
    () => listMistakes({ page, limit: 20, from: pr.from, to: pr.to }),
    [page, pr.from, pr.to]
  );

  const reversals = useLiveData(fetchReversals, [page, pr.from, pr.to], {
    topics: tab === "reversals" ? ["leads", "conversions"] : [],
  });
  const mistakes = useLiveData(fetchMistakes, [page, pr.from, pr.to], {
    topics: tab === "mistakes" ? ["conversions"] : [],
  });

  const active = tab === "reversals" ? reversals : mistakes;
  const res = active.data || { data: [], total: 0, page: 1, pages: 1 };

  const reversalColumns = [
    {
      key: "when",
      header: "When",
      render: (r) => (
        <div>
          <p className="text-gray-700">{fmtDateTime(r.createdAt)}</p>
          <p className="text-xs text-gray-400">{fromNow(r.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "who",
      header: "Reversed by",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-800">{r.author?.name || "—"}</p>
          <p className="text-xs text-gray-400 capitalize">{r.author?.role || ""}</p>
        </div>
      ),
    },
    {
      key: "lead",
      header: "Lead",
      render: (r) => (
        <div>
          <p className="text-gray-700">{r.lead?.name || "Deleted lead"}</p>
          <p className="text-xs text-gray-400">{r.lead?.restaurantName || r.lead?.assignedTo?.name || ""}</p>
        </div>
      ),
    },
    {
      key: "what",
      header: "What was reversed",
      render: (r) => <span className="text-gray-600">{r.text}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        r.lead?._id ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              nav(`/leads/${r.lead._id}`);
            }}
            className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600"
            title="Open lead"
          >
            <MdOpenInNew size={15} />
          </button>
        ) : null,
    },
  ];

  const mistakeColumns = [
    {
      key: "lead",
      header: "Outlet / lead",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-800">{r.outletName || r.lead?.name}</p>
          <p className="text-xs text-gray-400">{r.lead?.name !== r.outletName ? r.lead?.name : r.lead?.phone}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => typesByCode[r.conversionType]?.label || r.conversionType,
    },
    { key: "closedBy", header: "Closed by", render: (r) => r.convertedBy?.name || "—" },
    { key: "conversionDate", header: "Date", render: (r) => fmtDateTime(r.conversionDate) },
    {
      key: "deal",
      header: "Deal value",
      align: "right",
      render: (r) => <span className="text-gray-700">{inr(r.dealValue)}</span>,
    },
    {
      key: "received",
      header: "Received",
      align: "right",
      render: () => (
        <span className="inline-flex items-center gap-1 font-semibold text-red-500">
          <MdWarningAmber size={14} /> ₹0
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Review"
        subtitle="Reversed steps and conversions that might be missing a payment entry — for admin/manager oversight."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatCard
          label="Reversals"
          value={tab === "reversals" ? res.total : reversals.data?.total ?? "—"}
          icon={MdUndo}
          hint="Stage undos + reversed conversions"
        />
        <StatCard
          label="₹0-received conversions"
          value={tab === "mistakes" ? res.total : mistakes.data?.total ?? "—"}
          icon={MdErrorOutline}
          accent="text-red-500"
          hint="May just be a forgotten payment entry"
        />
      </div>

      <Card padding="p-2">
        <div className="px-2">
          <Tabs
            tabs={[
              { key: "reversals", label: "Reversals", count: reversals.data?.total },
              { key: "mistakes", label: "₹0 received", count: mistakes.data?.total },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>

        {tab === "reversals" ? (
          <DataTable
            columns={reversalColumns}
            rows={res.data}
            loading={reversals.loading}
            onRowClick={(r) => r.lead?._id && nav(`/leads/${r.lead._id}`)}
            empty={
              <EmptyState
                icon={MdUndo}
                title="No reversals in this window"
                message="Nobody's undone a stage move or reversed a conversion here — that's a good sign."
              />
            }
          />
        ) : (
          <DataTable
            columns={mistakeColumns}
            rows={res.data}
            loading={mistakes.loading}
            onRowClick={(r) => r.lead && nav(`/leads/${r.lead._id}`)}
            empty={
              <EmptyState
                icon={MdErrorOutline}
                title="No ₹0-received conversions"
                message="Every recorded conversion in this window has at least some payment logged."
              />
            }
          />
        )}

        <div className="px-2">
          <Pagination page={res.page} pages={res.pages} total={res.total} onChange={setPage} />
        </div>
      </Card>
    </div>
  );
}
