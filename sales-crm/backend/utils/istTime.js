// The business runs on India time. Reports slice by IST calendar month/week,
// not the server's timezone or UTC — so a stage change at 1 AM IST on the 1st
// counts in that month/week, not the last day of the previous one.
//
// IST is a fixed UTC+5:30 (no DST), so we can do the maths directly instead of
// dragging in a tz library.
export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000; // +5:30

// The UTC instant of 00:00 IST on (year, month=1-12, day).
export const istDate = (year, month, day = 1) =>
  new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - IST_OFFSET_MS);

// { $gte, $lt } for today's IST calendar day so far (midnight IST → now) —
// "today" must mean India's today even when the server runs in UTC, where
// midnight IST is 18:30 the previous day.
export function istTodayRange() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return { $gte: istDate(ist.getUTCFullYear(), ist.getUTCMonth() + 1, ist.getUTCDate()), $lt: now };
}

// { $gte, $lt } window for an IST calendar month, with the end capped at "now"
// so an in-progress month doesn't include days that haven't happened yet.
export function istMonthRange(year, month) {
  const start = istDate(year, month, 1);
  const nextMonthStart = istDate(year, month + 1, 1);
  const now = new Date();
  return { $gte: start, $lt: nextMonthStart > now ? now : nextMonthStart };
}

// The whole IST calendar month, NOT capped at "now" — use when upcoming items
// in the current month should still show (e.g. scheduled Zoom meetings that
// haven't happened yet).
export const istFullMonthRange = (year, month) => ({
  $gte: istDate(year, month, 1),
  $lt: istDate(year, month + 1, 1),
});

// Mongo aggregation: which week (1-4) of the IST month a date falls in.
// Days 29-31 fold into week 4.
export const weekOfIST = (dateField) => ({
  $min: [
    4,
    { $max: [1, { $ceil: { $divide: [{ $dayOfMonth: { date: dateField, timezone: IST_TZ } }, 7] } }] },
  ],
});

// Same thing in plain JS — which week (1-4) of its IST month a Date falls in.
export const istWeekOfMonth = (date) => {
  const day = new Date(new Date(date).getTime() + IST_OFFSET_MS).getUTCDate();
  return Math.min(4, Math.max(1, Math.ceil(day / 7)));
};

// A custom [from, to] IST day range (both "YYYY-MM-DD", both inclusive), as a
// {$gte, $lt} window — for reports that let someone pick their own dates
// instead of a calendar month. `to`'s day+1 rolls over months/years correctly
// since Date.UTC normalizes an out-of-range day (e.g. day 32 -> the 1st of
// the next month) on its own.
export function istDayRange(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  return { $gte: istDate(fy, fm, fd), $lt: istDate(ty, tm, td + 1) };
}

// Same, capped at "now" — for data that shouldn't include days that haven't
// happened yet (mirrors istMonthRange's cap).
export function istDayRangeCapped(fromStr, toStr) {
  const r = istDayRange(fromStr, toStr);
  const now = new Date();
  return { $gte: r.$gte, $lt: r.$lt > now ? now : r.$lt };
}
