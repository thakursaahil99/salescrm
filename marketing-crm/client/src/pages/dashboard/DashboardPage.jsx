import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import api from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { STAGES, STAGE_COLORS, CLIENT_TYPES } from "../../constants/index.js";

const PIE_COLORS = ["#C0392B", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899"];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [data, setData] = useState(null);
  const [slicer, setSlicer] = useState("all");
  const [month, setMonth] = useState("all");
  const [salespersons, setSalespersons] = useState([]);
  const [months, setMonths] = useState([]);

  const load = useCallback(async () => {
    const res = await api.get("/dashboard", { params: { slicer: isAdmin ? slicer : undefined, month } });
    setData(res.data);
  }, [isAdmin, slicer, month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) api.get("/leads/salespersons").then((res) => setSalespersons(res.data.data));
    api.get("/leads/months", { params: { slicer: isAdmin ? slicer : undefined } }).then((res) => setMonths(res.data.data));
  }, [isAdmin, slicer]);

  const goToLeads = (params) => navigate(`/leads?${new URLSearchParams(params).toString()}`);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const typeData = Object.entries(data.typeStats).map(([name, value]) => ({ name, value }));
  const stageData = STAGES.map((s) => ({ stage: s, count: data.stageStats[s] || 0 }));
  const teamRows = Object.entries(data.teamStats).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <select className="input w-auto" value={slicer} onChange={(e) => setSlicer(e.target.value)}>
              <option value="all">All Reps</option>
              {salespersons.map((s) => (
                <option key={s.username} value={s.username}>
                  {s.username}
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
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="Total Leads" value={data.totalLeads} onClick={() => goToLeads({})} />
        <KpiCard label="Today" value={data.todayLeads} />
        <KpiCard label="This Month" value={data.monthLeads} />
        <KpiCard
          label="Agreements"
          value={data.agreements}
          accent="text-green-600"
          onClick={() => goToLeads({ stage: "6.Agreement Done" })}
        />
        <KpiCard label="Dropped" value={data.dropped} accent="text-red-600" onClick={() => goToLeads({ stage: "Dropped" })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Pipeline Funnel</h3>
          <div className="space-y-2">
            {stageData.map((s) => (
              <button
                key={s.stage}
                onClick={() => goToLeads({ stage: s.stage })}
                className="w-full flex items-center gap-3 group"
              >
                <span className="text-xs text-gray-500 w-40 text-left truncate">{s.stage}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all group-hover:opacity-80"
                    style={{ width: `${data.totalLeads ? (s.count / data.totalLeads) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{s.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Client Type Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={typeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                onClick={(d) => goToLeads({ clientType: d.name })}
                className="cursor-pointer"
              >
                {typeData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {typeData.map((t, i) => (
              <span key={t.name} className="text-[11px] flex items-center gap-1 text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {t.name} ({t.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Month-over-Month Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.monthTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#C0392B" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {isAdmin && (
          <div className="card p-4 overflow-x-auto">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Team Performance</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 uppercase text-[10px]">
                  <th className="pb-2">Rep</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Agreements</th>
                  <th className="pb-2 text-right">Dropped</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map(([rep, stats]) => (
                  <tr
                    key={rep}
                    className="border-t border-gray-50 cursor-pointer hover:bg-gray-50"
                    onClick={() => goToLeads({ slicer: rep })}
                  >
                    <td className="py-2 font-semibold text-gray-700">{rep}</td>
                    <td className="py-2 text-right">{stats.total}</td>
                    <td className="py-2 text-right text-green-600">{stats.byStage["6.Agreement Done"] || 0}</td>
                    <td className="py-2 text-right text-red-500">{stats.byStage["Dropped"] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent = "text-gray-900", onClick }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`card p-4 text-left ${onClick ? "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150" : ""}`}
    >
      <p className="text-[11px] font-semibold text-gray-400 uppercase">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${accent}`}>{value}</p>
    </Comp>
  );
}
