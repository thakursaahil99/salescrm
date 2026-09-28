import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/auth/Login.jsx";
import Layout from "./components/layout/Layout.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";

// Loaded on first visit to each route instead of all being bundled into the
// one script the whole app has to download before anything renders.
const LeadsPage = lazy(() => import("./pages/leads/LeadsPage.jsx"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage.jsx"));
const UsersPage = lazy(() => import("./pages/users/UsersPage.jsx"));
const FmsPage = lazy(() => import("./pages/fms/FmsPage.jsx"));

function PageFallback() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-gray-400 text-sm">
      Loading…
    </div>
  );
}

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
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  );
}
