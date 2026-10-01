import { initials } from "../../utils/format.js";

// Soft, low-saturation tints so a column of avatars reads as calm texture,
// not confetti — the brand red stays reserved for actions and active state.
const TINTS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
  "bg-slate-200 text-slate-700",
];

// Same name → same colour, every render, on every page.
const tintFor = (name = "") => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
};

const SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-9 w-9 text-sm" };

export default function Avatar({ name, size = "sm", className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white ${SIZES[size]} ${tintFor(
        name
      )} ${className}`}
      aria-hidden="true"
    >
      {initials((name || "").replace(/[^\p{L}\s]/gu, " ")) || "?"}
    </span>
  );
}
