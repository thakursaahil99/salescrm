import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/auth/Login.jsx";
import Layout from "./components/layout/Layout.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import LeadsPage from "./pages/leads/LeadsPage.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import UsersPage from "./pages/users/UsersPage.jsx";
import FmsPage from "./pages/fms/FmsPage.jsx";

// When embedded under the Admin CRM shell, tell it which page we're on so a
// refresh of the shell tab can put the iframe back here instead of always
// booting it back to the default page.
function useReportRouteToShell() {
  const location = useLocation();
  useEffect(() => {
    if (window.self === window.top) return;
    window.top.postMessage(
      { type: "admin-crm-route", path: location.pathname + location.search },
      "*"
    );
  }, [location.pathname, location.search]);
}

export default function App() {
  useReportRouteToShell();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/fms" element={<FmsPage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="/" element={<Navigate to="/leads" replace />} />
      <Route path="*" element={<Navigate to="/leads" replace />} />
    </Routes>
  );
}
