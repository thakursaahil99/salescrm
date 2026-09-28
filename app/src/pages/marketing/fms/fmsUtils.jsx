// Small formatting helpers + the live countdown, shared by the FMS pages.
import { useEffect, useState } from "react";

export const STATUS_LABEL = {
  waiting: "Waiting", not_set: "Not Set", pending: "Pending", overdue: "Overdue",
  done_on_time: "Done On Time", done_late: "Done Late",
};
export const STATUS_CLASS = {
  waiting: "bg-gray-100 text-gray-500", not_set: "bg-gray-100 text-gray-500",
  pending: "bg-blue-100 text-blue-700", overdue: "bg-red-100 text-red-700",
  done_on_time: "bg-green-100 text-green-700", done_late: "bg-orange-100 text-orange-700",
};
export const COLOR = { onTime: "#16A34A", late: "#EA580C", overdue: "#DC2626", pending: "#2563EB", none: "#D1D5DB" };

export function fmtIN(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
export function fmtShort(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
export function fmtClock(ms) {
  const t = Math.floor(ms / 1000), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, "0");
  return (d ? `${d}d ` : "") + `${p(h)}:${p(m)}:${p(s)}`;
}
export function toInputDT(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function hmsToHours(h, m, s) {
  const total = Math.round((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0));
  return total > 0 ? total / 3600 : 0;
}
export function hoursToHms(hours) {
  const total = Math.round((Number(hours) || 0) * 3600);
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
export function fmtHMS(hours) {
  const t = hoursToHms(hours);
  if (!t.h && !t.m && !t.s) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${t.h}:${p(t.m)}:${p(t.s)}`;
}
export function fmtReal(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, out = [];
  if (d) out.push(`${d} ${d === 1 ? "day" : "days"}`);
  if (h) out.push(`${h} hr`);
  if (m) out.push(`${m} min`);
  if (s) out.push(`${s} sec`);
  return out.length ? out.join(" ") : "0 sec";
}

// A live "time left" / "overdue by" chip for one step's deadline.
export function Countdown({ plannedTs }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!plannedTs) return null;
  const diff = plannedTs - now;
  const over = diff <= 0;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums whitespace-nowrap ${over ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
      {over ? `⚠ Overdue by ${fmtClock(-diff)}` : `⏳ ${fmtClock(diff)} left`}
    </span>
  );
}

export function overallStatus(steps) {
  const order = ["overdue", "pending", "done_late", "done_on_time", "not_set"];
  let worst = "not_set";
  for (const s of steps) { const k = order.indexOf(s.status); if (k >= 0 && k < order.indexOf(worst)) worst = s.status; }
  return worst;
}
export function nextStep(steps) {
  return steps.find((s) => s.status === "pending" || s.status === "overdue") || null;
}
