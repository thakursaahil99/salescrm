import { STAGE_COLORS, CLIENT_TYPE_COLORS } from "./constants.js";

export function StageBadge({ stage }) {
  return <span className={`badge ${STAGE_COLORS[stage] || "bg-gray-100 text-gray-700"}`}>{stage}</span>;
}

export function ClientTypeBadge({ type }) {
  return <span className={`badge ${CLIENT_TYPE_COLORS[type] || "bg-gray-100 text-gray-700"}`}>{type}</span>;
}
