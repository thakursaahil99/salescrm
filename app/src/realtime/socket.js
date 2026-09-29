import { io } from "socket.io-client";

// socket.io attaches directly to the combined backend's raw HTTP server at
// /sales/socket.io/ (see combined-server/index.js), not under the /sales
// Express mount prefix for REST calls — so this connects to the backend's
// root origin, not VITE_API_URL itself (which is ".../sales/api").
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:6100/api";
const SOCKET_ORIGIN = API_URL.replace(/\/sales\/api\/?$/, "").replace(/\/api\/?$/, "");

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_ORIGIN, { path: "/sales/socket.io/", autoConnect: false });
    // The server coalesces a burst of writes into one "sync" hint —
    // { topics, at } — naming which slices of data changed. Re-broadcast it
    // as a plain DOM event so any component (useLiveData included) can
    // listen without importing this module or holding a socket reference.
    socket.on("sync", (payload) => {
      window.dispatchEvent(new CustomEvent("crm:sync", { detail: payload }));
    });
  }
  return socket;
}

// Called once a Sales CRM token exists (login, or a page load that
// revalidated one). Reconnecting with the same token is a no-op if already
// connected — socket.io dedupes via `connected`.
export function connectRealtime(token) {
  if (!token) return;
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
}

export function disconnectRealtime() {
  socket?.disconnect();
}
