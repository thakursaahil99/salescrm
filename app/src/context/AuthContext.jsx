import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../services/api.js";
import marketingApi from "../services/marketingApi.js";
import { connectRealtime, disconnectRealtime } from "../realtime/socket.js";
import { connectSocket, getSocket } from "../marketing-lib/socket.js";

const AuthContext = createContext(null);

// This app talks to two separate backend user systems on the combined
// server (Sales CRM's own User collection at /sales/api, Marketing CRM's
// own at /marketing/api) — there's no single shared login. One login screen
// submits the same typed identifier + password to BOTH at once (mirroring
// the old Admin CRM shell's approach); whichever accept it become
// available. Someone who only ever had an account on one side never gets
// the other side's token, and the sidebar/routes hide accordingly.
//
// `user` here is deliberately the SALES side, unprefixed — every one of the
// ~20 Sales CRM pages ported into this app already calls `useAuth()`
// expecting exactly that shape (user/loading/isAuthenticated), and none of
// them needed to change to keep working. The Marketing side is additive,
// under `marketing`.

function readStored(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function storeSide(tokenKey, userKey, token, user) {
  if (token) {
    sessionStorage.setItem(tokenKey, token);
    sessionStorage.setItem(userKey, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(userKey);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStored("rbh_user"));
  const [marketingUser, setMarketingUser] = useState(() => readStored("mcrm_user"));
  const [loading, setLoading] = useState(true);

  // On first load, re-validate whatever tokens survived in sessionStorage —
  // a token surviving doesn't mean it's still valid (expired, or the
  // account deactivated since the tab was last open).
  useEffect(() => {
    let cancelled = false;
    async function revalidate() {
      const salesToken = sessionStorage.getItem("rbh_token");
      const marketingToken = sessionStorage.getItem("mcrm_token");

      const [salesRes, marketingRes] = await Promise.allSettled([
        salesToken ? api.get("/auth/me") : Promise.resolve(null),
        marketingToken ? marketingApi.get("/auth/me") : Promise.resolve(null),
      ]);
      if (cancelled) return;

      if (salesRes.status === "fulfilled" && salesRes.value) {
        setUser(salesRes.value.data.user);
        sessionStorage.setItem("rbh_user", JSON.stringify(salesRes.value.data.user));
      } else if (salesToken) {
        storeSide("rbh_token", "rbh_user", null);
        setUser(null);
      }

      if (marketingRes.status === "fulfilled" && marketingRes.value) {
        setMarketingUser(marketingRes.value.data.user);
        sessionStorage.setItem("mcrm_user", JSON.stringify(marketingRes.value.data.user));
      } else if (marketingToken) {
        storeSide("mcrm_token", "mcrm_user", null);
        setMarketingUser(null);
      }

      setLoading(false);
    }
    revalidate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tries the same identifier+password against both backends at once.
  // Succeeds as long as at least one accepts it.
  const login = useCallback(async (identifier, password) => {
    const [salesRes, marketingRes] = await Promise.allSettled([
      api.post("/auth/login", { email: identifier, password }),
      marketingApi.post("/auth/login", { username: identifier, password }),
    ]);

    const salesOk = salesRes.status === "fulfilled";
    const marketingOk = marketingRes.status === "fulfilled";
    if (!salesOk && !marketingOk) {
      throw new Error("That username/email and password didn't work on either CRM.");
    }

    if (salesOk) {
      const { token, user: u } = salesRes.value.data;
      storeSide("rbh_token", "rbh_user", token, u);
      setUser(u);
    } else {
      storeSide("rbh_token", "rbh_user", null);
      setUser(null);
    }

    if (marketingOk) {
      const { token, user: u } = marketingRes.value.data;
      storeSide("mcrm_token", "mcrm_user", token, u);
      setMarketingUser(u);
    } else {
      storeSide("mcrm_token", "mcrm_user", null);
      setMarketingUser(null);
    }

    return { sales: salesOk, marketing: marketingOk };
  }, []);

  const logout = useCallback(() => {
    storeSide("rbh_token", "rbh_user", null);
    storeSide("mcrm_token", "mcrm_user", null);
    setUser(null);
    setMarketingUser(null);
  }, []);

  // Connect (or reconnect with a fresh token) whenever the Sales side logs
  // in; disconnect once it logs out. Marketing CRM's own socket.io stays on
  // its separate connection (below), unaffected.
  useEffect(() => {
    if (user) connectRealtime(sessionStorage.getItem("rbh_token"));
    else disconnectRealtime();
  }, [user]);

  // Same for the Marketing side — its socket.io identifies by username
  // (server-side room join), not a JWT, since emitLeadEvent() broadcasts to
  // everyone and only emitToUser() needs the per-user room.
  useEffect(() => {
    if (marketingUser?.username) connectSocket(marketingUser.username);
    else getSocket().disconnect();
  }, [marketingUser]);

  const value = {
    user, // sales user — unchanged shape existing Sales pages already expect
    loading,
    login,
    logout,
    isAuthenticated: !!(user || marketingUser),
    marketing: { user: marketingUser, loading },
    // True once someone is admin on at least one side — decides whether the
    // sidebar shows both sections or just the one they have.
    isAdmin: user?.role === "admin" || marketingUser?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
