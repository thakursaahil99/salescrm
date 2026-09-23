import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api.js";
import { connectSocket, getSocket } from "../lib/socket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("mcrm_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("mcrm_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem("mcrm_user", JSON.stringify(res.data.user));
        connectSocket(res.data.user.username);
      })
      .catch(() => {
        localStorage.removeItem("mcrm_token");
        localStorage.removeItem("mcrm_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    localStorage.setItem("mcrm_token", res.data.token);
    localStorage.setItem("mcrm_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    connectSocket(res.data.user.username);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("mcrm_token");
    localStorage.removeItem("mcrm_user");
    setUser(null);
    getSocket().disconnect();
    // Embedded under the Admin CRM shell (iframe)? Tell it too, so it clears
    // its own session and returns to the Admin CRM login instead of leaving
    // this app's now-logged-out login screen stuck inside the frame.
    if (window.self !== window.top) {
      window.top.postMessage({ type: "admin-crm-logout" }, "*");
    }
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
