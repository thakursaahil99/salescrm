import { useEffect, useMemo, useState } from "react";

// Each CRM's own backend + the login field it expects. Marketing CRM logs in
// by username; Sales CRM's "email" field actually accepts a username OR an
// email. The shell tries the SAME typed identifier+password against both —
// whichever succeeds becomes available in the sidebar with no second login
// screen (its real token is handed to the embedded app via the URL). A
// person who only has an account on one CRM simply doesn't see the other.
const CRM_DEFS = [
  {
    id: "marketing",
    label: "Marketing CRM",
    appUrl: import.meta.env.VITE_MARKETING_APP_URL || "http://localhost:6173",
    apiUrl: (import.meta.env.VITE_MARKETING_API_URL || "http://localhost:6050") + "/api",
    loginBody: (identifier, password) => ({ username: identifier, password }),
    ready: true,
  },
  {
    id: "sales",
    label: "Sales CRM",
    appUrl: import.meta.env.VITE_SALES_APP_URL || "http://localhost:6175",
    apiUrl: (import.meta.env.VITE_SALES_API_URL || "http://localhost:6100") + "/api",
    loginBody: (identifier, password) => ({ email: identifier, password }),
    ready: true,
  },
  { id: "hrm", label: "HRM", appUrl: "", apiUrl: "", ready: false },
];

const CREDS_KEY = "admin_crm_creds"; // { [crmId]: { token, user } }

function loadCreds() {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY)) || null;
  } catch {
    return null;
  }
}

async function loginToCrm(def, identifier, password) {
  const res = await fetch(`${def.apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(def.loginBody(identifier, password)),
  });
  if (!res.ok) throw new Error(`${def.label}: invalid login.`);
  const data = await res.json();
  if (!data.token) throw new Error(`${def.label}: no token returned.`);
  return { token: data.token, user: data.user };
}

function Login({ onLoggedIn }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const attempts = CRM_DEFS.filter((d) => d.ready);
      const results = await Promise.allSettled(attempts.map((d) => loginToCrm(d, identifier, password)));
      const creds = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") creds[attempts[i].id] = r.value;
      });
      if (Object.keys(creds).length === 0) {
        setError("That username/email and password didn't work on either CRM.");
        return;
      }
      localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
      onLoggedIn(creds);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">RB</div>
        <h1>Admin CRM</h1>
        <p className="login-sub">RedBean Hospitality</p>
        <label>Username or Email</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus required />
        <label>Password</label>
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" className="eye-toggle" onClick={() => setShowPassword((s) => !s)} tabIndex={-1}>
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign In"}</button>
        <p className="login-hint">Use your existing Marketing CRM or Sales CRM login — whichever one it matches opens.</p>
      </form>
    </div>
  );
}

export default function App() {
  const [creds, setCreds] = useState(() => loadCreds());
  const [active, setActive] = useState(null);

  useEffect(() => {
    document.title = "Admin CRM";
  }, []);

  useEffect(() => {
    if (creds && !active) {
      const first = CRM_DEFS.find((c) => c.ready && creds[c.id]);
      if (first) setActive(first.id);
    }
  }, [creds, active]);

  // A child CRM, embedded in the iframe, has its own logout button (in its own
  // sidebar/nav). Clicking that only clears ITS localStorage and shows ITS own
  // login screen inside the frame — the shell never finds out, so it keeps
  // thinking the session is live. Each child app posts this message on logout
  // (see its AuthContext) so the shell can clear its own session too and drop
  // back to the Admin CRM login instead of leaving a dead CRM login in the frame.
  useEffect(() => {
    const knownOrigins = new Set(CRM_DEFS.filter((c) => c.appUrl).map((c) => new URL(c.appUrl).origin));
    const onMessage = (event) => {
      if (!knownOrigins.has(event.origin)) return;
      if (event.data?.type === "admin-crm-logout") {
        localStorage.removeItem(CREDS_KEY);
        setCreds(null);
        setActive(null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const current = CRM_DEFS.find((c) => c.id === active) || null;
  const frameSrc = useMemo(() => {
    if (!creds || !current || !current.ready) return "";
    const c = creds[current.id];
    if (!c) return current.appUrl;
    const params = new URLSearchParams({ sso_token: c.token, sso_user: JSON.stringify(c.user) });
    return `${current.appUrl}/?${params.toString()}`;
  }, [current, creds]);

  if (!creds) return <Login onLoggedIn={setCreds} />;

  const doLogout = () => {
    localStorage.removeItem(CREDS_KEY);
    setCreds(null);
    setActive(null);
  };

  // The multi-CRM switcher is an admin-only view: only someone who is "admin"
  // on at least one of the CRMs they logged into sees every section. Everyone
  // else (manager, salesperson, ...) only ever has one CRM to begin with, and
  // goes straight into it full-screen — no sidebar listing what they can't open.
  const isAdmin = Object.values(creds).some((c) => c.user?.role === "admin");

  if (!isAdmin) {
    return (
      <div className="shell single">
        {current && creds[current.id] ? (
          <iframe key={current.id} title={current.label} src={frameSrc} className="crm-frame" />
        ) : (
          <div className="placeholder">No CRM access found for this login.</div>
        )}
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="login-logo small">RB</div>
          <div>
            <p className="brand-title">Admin CRM</p>
            <p className="brand-sub">RedBean Hospitality</p>
          </div>
        </div>
        <nav>
          {CRM_DEFS.map((c) => {
            const hasAccess = c.ready && !!creds[c.id];
            return (
              <button
                key={c.id}
                className={`nav-item ${active === c.id ? "active" : ""} ${!hasAccess ? "disabled" : ""}`}
                onClick={() => hasAccess && setActive(c.id)}
                disabled={!hasAccess}
              >
                {c.label}
                {!c.ready && <span className="soon">coming soon</span>}
                {c.ready && !hasAccess && <span className="soon">no access</span>}
              </button>
            );
          })}
        </nav>
        <button className="logout" onClick={doLogout}>
          Logout
        </button>
      </aside>
      <main className="content">
        {current && current.ready && creds[current.id] ? (
          <iframe key={current.id} title={current.label} src={frameSrc} className="crm-frame" />
        ) : (
          <div className="placeholder">Pick a CRM from the left.</div>
        )}
      </main>
    </div>
  );
}
