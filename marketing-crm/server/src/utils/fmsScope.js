// Same privacy rule as leadScope.js, for FMS entries: a "sales" user only ever sees entries whose
// assignedTo is their own username (in any FMS); admin sees everything.
export function buildFmsEntryFilter({ role, username }, extra = {}) {
  const filter = { ...extra };
  if (role === "sales") filter.assignedTo = username;
  return filter;
}

export function canAccessFmsEntry(entry, { role, username }) {
  if (role === "admin" || role === "manager") return true;
  return entry.assignedTo === username;
}
