import { MONTHS } from "../utils/format.js";
import Listbox from "./ui/Listbox.jsx";

// Two selects — month + year. `value` is { month, year }; `onChange` gets the
// next value. `month` is normally 1–12, but with `allowToday` / `allowYear` /
// `allowAllTime` it can also be the string "today" (today only), "year"
// (whole selected year) or "all" (all time) — the year select hides for
// "today" and "all", since it no longer applies.
const SPECIAL = ["today", "year", "all"];

export default function MonthPicker({ value, onChange, allowToday = false, allowYear = false, allowAllTime = false }) {
  const years = [0, 1, 2].map((d) => new Date().getFullYear() - d);
  const hideYear = value.month === "all" || value.month === "today";
  const setMonth = (raw) => {
    const month = SPECIAL.includes(raw) ? raw : Number(raw);
    // Today is always this calendar year — snap the year back so switching
    // from "Today" to a month afterwards starts from the current year.
    onChange({ ...value, month, year: month === "today" ? new Date().getFullYear() : value.year });
  };

  const monthOptions = [
    ...(allowToday ? [{ value: "today", label: "Today" }] : []),
    ...(allowAllTime ? [{ value: "all", label: "All time" }] : []),
    ...(allowYear ? [{ value: "year", label: "Full year" }] : []),
    ...MONTHS.map((m, i) => ({ value: i + 1, label: m })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <Listbox className="w-32" value={value.month} onChange={setMonth} options={monthOptions} />
      {!hideYear && (
        <Listbox
          className="w-24"
          value={value.year}
          onChange={(y) => onChange({ ...value, year: Number(y) })}
          options={years.map((y) => ({ value: y, label: String(y) }))}
        />
      )}
    </div>
  );
}
