import { MONTHS } from "../utils/format.js";
import Listbox from "./ui/Listbox.jsx";

// Two selects — month + year. `value` is { month, year }; `onChange` gets the
// next value. `month` is normally 1–12, but with the allow* props it can also
// be one of: "today", "week" (last 7 days), "year" (whole year), "all" (all
// time). The year select hides when it doesn't apply (today / week / all).
const SPECIAL = ["today", "week", "year", "all"];
const HIDE_YEAR = new Set(["today", "week", "all"]);

export default function MonthPicker({
  value,
  onChange,
  allowToday = false,
  allowWeek = false,
  allowYear = false,
  allowAllTime = false,
}) {
  const years = [0, 1, 2].map((d) => new Date().getFullYear() - d);
  const hideYear = HIDE_YEAR.has(value.month);

  const setMonth = (raw) => {
    const month = SPECIAL.includes(raw) ? raw : Number(raw);
    // Snap year back to current when switching from a special mode so a
    // subsequent month pick starts from the right year.
    onChange({
      ...value,
      month,
      year: HIDE_YEAR.has(month) ? new Date().getFullYear() : value.year,
    });
  };

  const monthOptions = [
    ...(allowToday ? [{ value: "today", label: "Today" }] : []),
    ...(allowWeek ? [{ value: "week", label: "Last 7 days" }] : []),
    ...(allowAllTime ? [{ value: "all", label: "All time" }] : []),
    ...(allowYear ? [{ value: "year", label: "Full year" }] : []),
    ...MONTHS.map((m, i) => ({ value: i + 1, label: m })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <Listbox className="w-36" value={value.month} onChange={setMonth} options={monthOptions} />
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
