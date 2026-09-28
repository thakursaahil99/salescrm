import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Upload, Search, Trash2, Pencil, PencilLine, Eye, X } from "lucide-react";
import api from "../../../services/marketingApi.js";
import { getSocket } from "../../../marketing-lib/socket.js";
import { useAuth } from "../../../marketing-lib/useAuth.js";
import { useToast } from "../../../marketing-lib/useToast.js";
import { StageBadge, ClientTypeBadge } from "../../../marketing-lib/Badge.jsx";
import { STAGES, CLIENT_TYPES } from "../../../marketing-lib/constants.js";
import AddLeadModal from "./AddLeadModal.jsx";
import EditLeadModal from "./EditLeadModal.jsx";
import QuickUpdateModal from "./QuickUpdateModal.jsx";
import ViewLeadModal from "./ViewLeadModal.jsx";
import ImportModal from "./ImportModal.jsx";

export default function LeadsPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salespersons, setSalespersons] = useState([]);
  const [months, setMonths] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [slicer, setSlicer] = useState(searchParams.get("slicer") || "all");
  const [month, setMonth] = useState(searchParams.get("month") || "all");
  const [stageFilter, setStageFilter] = useState(searchParams.get("stage") || "all");
  const [clientTypeFilter, setClientTypeFilter] = useState(searchParams.get("clientType") || "all");
  const [search, setSearch] = useState("");

  // Keeps the URL in sync with the active filters so a drill-down link from
  // the Dashboard (e.g. /leads?stage=Dropped) stays bookmarkable/shareable
  // instead of being wiped right after it's applied.
  useEffect(() => {
    const next = {};
    if (isAdmin && slicer !== "all") next.slicer = slicer;
    if (month !== "all") next.month = month;
    if (stageFilter !== "all") next.stage = stageFilter;
    if (clientTypeFilter !== "all") next.clientType = clientTypeFilter;
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, slicer, month, stageFilter, clientTypeFilter]);

  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null); // { type: 'add'|'edit'|'quick'|'view'|'import', lead }

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/leads", {
        params: {
          slicer: isAdmin ? slicer : undefined,
          month,
          stage: stageFilter,
          clientType: clientTypeFilter,
          search: search || undefined,
        },
      });
      setLeads(res.data.data);
    } catch (err) {
      push(err.response?.data?.msg || "Failed to load leads.", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, slicer, month, stageFilter, clientTypeFilter, search]);

  useEffect(() => {
    if (isAdmin) {
      api.get("/leads/salespersons").then((res) => setSalespersons(res.data.data));
    }
  }, [isAdmin]);

  useEffect(() => {
    api.get("/leads/months", { params: { slicer: isAdmin ? slicer : undefined } }).then((res) => setMonths(res.data.data));
  }, [isAdmin, slicer]);

  useEffect(() => {
    const t = setTimeout(loadLeads, 250);
    return () => clearTimeout(t);
  }, [loadLeads]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => loadLeads();
    socket.on("lead:created", refresh);
    socket.on("lead:updated", refresh);
    socket.on("lead:deleted", refresh);
    socket.on("lead:imported", refresh);
    return () => {
      socket.off("lead:created", refresh);
      socket.off("lead:updated", refresh);
      socket.off("lead:deleted", refresh);
      socket.off("lead:imported", refresh);
    };
  }, [loadLeads]);

  const stageCounts = useMemo(() => {
    const counts = {};
    for (const s of STAGES) counts[s] = 0;
    for (const l of leads) counts[l.stage] = (counts[l.stage] || 0) + 1;
    return counts;
  }, [leads]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((l) => l._id))));
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} selected lead(s)? This cannot be undone.`)) return;
    try {
      await api.delete("/leads", { data: { ids: [...selected] } });
      push(`Deleted ${selected.size} lead(s).`, "success");
      setSelected(new Set());
      loadLeads();
    } catch (err) {
      push(err.response?.data?.msg || "Delete failed.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Leads</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button className="btn-secondary" onClick={() => setModal({ type: "import" })}>
              <Upload size={16} /> Import
            </button>
          )}
          <button className="btn-primary" onClick={() => setModal({ type: "add" })}>
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="card p-3 flex flex-wrap items-center gap-3">
          <select className="input w-auto" value={slicer} onChange={(e) => setSlicer(e.target.value)}>
            <option value="all">All Reps</option>
            {salespersons.map((s) => (
              <option key={s.username} value={s.username}>
                {s.username}
                {s.frozen ? " (frozen)" : ""}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All Months</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStageFilter("all")}
          className={`badge cursor-pointer transition-transform hover:scale-105 ${
            stageFilter === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          All ({leads.length})
        </button>
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={`badge cursor-pointer transition-transform hover:scale-105 ${
              stageFilter === s ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {s} ({stageCounts[s] || 0})
          </button>
        ))}
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search site, contact, location, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={clientTypeFilter} onChange={(e) => setClientTypeFilter(e.target.value)}>
          <option value="all">All Client Types</option>
          {CLIENT_TYPES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="card p-3 flex items-center justify-between bg-brand-50 border-brand/30">
          <span className="text-sm font-semibold text-brand-dark">{selected.size} lead(s) selected</span>
          <div className="flex items-center gap-2">
            <button className="btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={16} /> Delete Selected
            </button>
            <button className="btn-icon" onClick={() => setSelected(new Set())}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="p-3 w-10">
                <input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleSelectAll} />
              </th>
              <th className="p-3">Site / Client</th>
              <th className="p-3">Contact</th>
              {isAdmin && <th className="p-3">Rep</th>}
              <th className="p-3">Stage</th>
              <th className="p-3">Latest Remark</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">
                  No leads found.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(lead._id)} onChange={() => toggleSelect(lead._id)} />
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-gray-900">{lead.siteName}</p>
                    <ClientTypeBadge type={lead.clientType} />
                  </td>
                  <td className="p-3">
                    <p className="text-gray-700">{lead.contactPerson}</p>
                    <p className="text-gray-400 text-xs">{lead.contactNo}</p>
                  </td>
                  {isAdmin && <td className="p-3 text-gray-600">{lead.leadHead}</td>}
                  <td className="p-3">
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td className="p-3 max-w-[220px] truncate text-gray-500" title={lead.remarks}>
                    {lead.remarks || "—"}
                  </td>
                  <td className="p-3 text-gray-500 whitespace-nowrap">
                    {lead.timestamp ? new Date(lead.timestamp).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn-icon" title="Quick Update" onClick={() => setModal({ type: "quick", lead })}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn-icon" title="Full Edit" onClick={() => setModal({ type: "edit", lead })}>
                        <PencilLine size={15} />
                      </button>
                      <button className="btn-icon" title="View" onClick={() => setModal({ type: "view", lead })}>
                        <Eye size={15} />
                      </button>
                      <button
                        className="btn-icon hover:!bg-red-50 hover:!text-red-600"
                        title="Delete"
                        onClick={async () => {
                          if (!confirm(`Delete lead "${lead.siteName}"?`)) return;
                          try {
                            await api.delete("/leads", { data: { ids: [lead._id] } });
                            push("Lead deleted.", "success");
                            loadLeads();
                          } catch (err) {
                            push(err.response?.data?.msg || "Delete failed.", "error");
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddLeadModal
        open={modal?.type === "add"}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          loadLeads();
        }}
        salespersons={salespersons}
        isAdmin={isAdmin}
      />
      <EditLeadModal
        open={modal?.type === "edit"}
        lead={modal?.lead}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          loadLeads();
        }}
        salespersons={salespersons}
        isAdmin={isAdmin}
      />
      <QuickUpdateModal
        open={modal?.type === "quick"}
        lead={modal?.lead}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          loadLeads();
        }}
      />
      <ViewLeadModal lead={modal?.lead} open={modal?.type === "view"} onClose={() => setModal(null)} />
      <ImportModal
        open={modal?.type === "import"}
        onClose={() => setModal(null)}
        onImported={() => {
          setModal(null);
          loadLeads();
        }}
      />
    </div>
  );
}
