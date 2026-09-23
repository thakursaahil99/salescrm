// The FMS deadline engine: a step's deadline is exactly the time entered for it (no multiplier). Step 1
// starts at the entry date/time; every later step starts the moment the step before it was marked done.
// Sundays and the company holidays never count towards a deadline — the clock skips those whole days
// (India calendar), so e.g. a 48-hour step filled in on Monday with Tuesday a holiday is due Thursday.

const IST_MS = 19800000; // +05:30
const DAY_MS = 86400000;

export function dayIndex(ms) {
  return Math.floor((ms + IST_MS) / DAY_MS);
}

export function dateKeyFromMs(ms) {
  const d = new Date(ms + IST_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// True for a Sunday (epoch day 0, 1 Jan 1970, was a Thursday, so (day + 4) % 7 === 0 lands on Sunday).
function isSunday(day) {
  return (day + 4) % 7 === 0;
}

function isOffDay(day, holidayDays) {
  return isSunday(day) || holidayDays.has(day);
}

// startMs + durationMs of WORKING time: every off day is skipped whole.
export function addWorkingMs(startMs, durationMs, holidayDays) {
  let t = startMs;
  let rem = durationMs;
  for (let guard = 0; guard < 200000; guard++) {
    const day = dayIndex(t);
    const dayEnd = (day + 1) * DAY_MS - IST_MS;
    if (isOffDay(day, holidayDays)) {
      t = dayEnd;
      continue;
    }
    if (rem <= dayEnd - t) return t + rem;
    rem -= dayEnd - t;
    t = dayEnd;
  }
  return t + rem;
}

// hours (fractional) -> the deadline that many working hours after startMs (rounded to whole seconds so
// floating-point error can never shift a deadline).
export function plannedFrom(startMs, hours, holidayDays) {
  if (!startMs || !hours) return null;
  const sec = Math.round(Number(hours) * 3600);
  return addWorkingMs(startMs, sec * 1000, holidayDays);
}

// One Planned date per step: step i starts at actuals[i-1] (or entryMs for step 0). A step with no start
// yet (the step before it is not done) or no timing gets planned = null.
export function computeChain(entryMs, hoursArr, actualsMsArr, holidayDays) {
  const out = [];
  let start = entryMs;
  for (let i = 0; i < hoursArr.length; i++) {
    const h = Number(hoursArr[i]) || 0;
    out.push(start && h > 0 ? plannedFrom(start, h, holidayDays) : null);
    start = actualsMsArr[i] || null;
  }
  return out;
}

// "waiting" (the step before it is not done, so it has not started) / "not_set" (no timing, and it has
// started) / "pending" / "overdue" / "done_on_time" / "done_late"
export function stepStatus(plannedMs, actualMs, waiting, nowMs = Date.now()) {
  if (!plannedMs) return waiting ? "waiting" : "not_set";
  if (actualMs) return actualMs <= plannedMs ? "done_on_time" : "done_late";
  return nowMs > plannedMs ? "overdue" : "pending";
}

export function holidaySetFrom(holidayDocs) {
  const days = new Set();
  for (const h of holidayDocs) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(h.date);
    if (!m) continue;
    days.add(Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS));
  }
  return days;
}

// Parses a "YYYY-MM-DD" (optionally with a day-first "DD/MM/YYYY") holiday date into a day index, or null.
export function parseHolidayDate(v) {
  const s = String(v || "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!m) m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s) && [null, ...s.split(/[/\-.]/).reverse()];
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  const p = (n) => String(n).padStart(2, "0");
  return { key: `${y}-${p(mo)}-${p(d)}`, day: Math.floor(t.getTime() / DAY_MS) };
}

export { IST_MS, DAY_MS };
