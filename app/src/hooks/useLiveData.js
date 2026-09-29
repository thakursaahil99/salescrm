import { useCallback, useEffect, useRef, useState } from "react";

// Fetch once, then keep the data fresh in the background — re-fetch on an
// interval, whenever the tab regains focus, and (if `topics` is given)
// the instant the server pushes a matching "crm:sync" event over
// socket.io (see realtime/socket.js) — without ever flashing a spinner
// after the first load. `deps` triggers a full (spinner-shown) reload when
// they change, e.g. a month filter. Returns the data plus `refreshedAt`
// (ms epoch) and a manual `reload()` that refreshes silently.
//
// `topics` ⊂ leads|reminders|conversions|calls|dashboard — matches what the
// backend's emitSync() calls pass (see sales-crm/backend/realtime/io.js and
// every model that writes through it). Omit it to keep this hook polling
// only, e.g. for data the server never pushes sync hints for.
export function useLiveData(fetcher, deps = [], { intervalMs = 20000, topics = [] } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null, refreshedAt: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // Guards against an out-of-order response: if the filters change twice in a
  // row and the first request happens to resolve after the second (a slow
  // network, a heavier date range), its stale data must not overwrite the
  // fresher one. Only the response to the most recently issued call is ever
  // applied.
  const requestIdRef = useRef(0);

  const load = useCallback((silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));
    const requestId = ++requestIdRef.current;
    return fetcherRef
      .current()
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setState({ data, loading: false, error: null, refreshedAt: Date.now() });
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: typeof err === "string" ? err : "Couldn't refresh — will retry.",
        }));
      });
  }, []);

  // Full load whenever the deps change (first mount included).
  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Background polling + refresh when the tab comes back into focus. Stays
  // on even when `topics` is set — the socket can drop and reconnect, and
  // polling is what makes that invisible instead of going stale.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const id = setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, intervalMs]);

  // Instant refresh on a matching push from the server — the gap this closes
  // is another salesperson's change (or this same user's, from another tab)
  // showing up now instead of up to `intervalMs` later.
  const topicsKey = topics.join(",");
  useEffect(() => {
    if (!topicsKey) return;
    const wanted = topicsKey.split(",");
    const onSync = (e) => {
      const changed = e.detail?.topics || [];
      if (changed.some((t) => wanted.includes(t))) load(true);
    };
    window.addEventListener("crm:sync", onSync);
    return () => window.removeEventListener("crm:sync", onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, topicsKey]);

  return { ...state, reload: () => load(true) };
}
