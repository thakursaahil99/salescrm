// Builds the Mongo filter that enforces the privacy rule everywhere leads are
// read: a "sales" user only ever sees rows where leadHead === their own
// username. Admin sees everything, optionally narrowed by a slicer (a
// specific rep's username, or "all").
export function buildLeadFilter({ role, username }, { slicer, month, extra } = {}) {
  const filter = {};

  if (role === "sales") {
    filter.leadHead = username;
  } else if (slicer && slicer !== "all") {
    filter.leadHead = slicer;
  }

  if (month && month !== "all") {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      filter.timestamp = { $gte: start, $lt: end };
    }
  }

  return Object.assign(filter, extra || {});
}

// Ownership check used by quick-update / full-edit / delete / reminders:
// a sales user may only mutate leads whose leadHead is their own username.
export function canAccessLead(lead, { role, username }) {
  if (role === "admin" || role === "manager") return true;
  return lead.leadHead === username;
}
