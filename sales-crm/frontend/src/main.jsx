import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./index.css";

// SSO handoff from the Admin CRM shell: if the shell embedded this app with a
// token in the URL (?sso_token=...&sso_user=...), adopt it before the app
// renders so there is no separate login step inside the frame.
(function adoptSSO() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("sso_token");
  const userRaw = params.get("sso_user");
  if (token && userRaw) {
    try {
      sessionStorage.setItem("rbh_token", token);
      sessionStorage.setItem("rbh_user", userRaw);
    } catch {}
    params.delete("sso_token");
    params.delete("sso_user");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
