import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ProtectedMarketingRoute from "./components/ProtectedMarketingRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { ROLES } from "./utils/roles.js";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import Unauthorized from "./pages/Unauthorized.jsx";

const MarketingLeads = lazy(() => import("./pages/marketing/leads/LeadsPage.jsx"));
const MarketingDashboard = lazy(() => import("./pages/marketing/dashboard/DashboardPage.jsx"));
const MarketingFms = lazy(() => import("./pages/marketing/fms/FmsPage.jsx"));
const MarketingUsers = lazy(() => import("./pages/marketing/users/UsersPage.jsx"));

// Loaded on first visit to each route instead of all being bundled into the
// one script the whole app has to download before anything renders — that
// single bundle (charts, PDF/CSV export, every page) was the main reason the
// app felt slow just to open, even before clicking anything.
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const SalesTeamList = lazy(() => import("./pages/salesTeam/SalesTeamList.jsx"));
const Settings = lazy(() => import("./pages/settings/Settings.jsx"));
const LeadsBoard = lazy(() => import("./pages/leads/LeadsBoard.jsx"));
const LeadDetail = lazy(() => import("./pages/leads/LeadDetail.jsx"));
const WebinarsList = lazy(() => import("./pages/webinars/WebinarsList.jsx"));
const WebinarDetail = lazy(() => import("./pages/webinars/WebinarDetail.jsx"));
const EventsList = lazy(() => import("./pages/events/EventsList.jsx"));
const EventDetail = lazy(() => import("./pages/events/EventDetail.jsx"));
const IfoList = lazy(() => import("./pages/ifo/IfoList.jsx"));
const TargetsList = lazy(() => import("./pages/targets/TargetsList.jsx"));
const CallingReport = lazy(() => import("./pages/reports/CallingReport.jsx"));
const FunnelReport = lazy(() => import("./pages/reports/FunnelReport.jsx"));
const Receivables = lazy(() => import("./pages/reports/Receivables.jsx"));
const PaymentDelays = lazy(() => import("./pages/reports/PaymentDelays.jsx"));
const Leaderboard = lazy(() => import("./pages/leaderboard/Leaderboard.jsx"));
const ReviewPage = lazy(() => import("./pages/audit/ReviewPage.jsx"));

function PageFallback() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-gray-400 text-sm">
      Loading…
    </div>
  );
}

const MANAGERS = [ROLES.ADMIN, ROLES.MANAGER];

// "/" needs to land wherever this login actually has access — a
// Marketing-only account has no Sales session for "/dashboard" to show.
function RootRedirect() {
  const { user, marketing, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (user) return <Navigate to="/dashboard" replace />;
  if (marketing.user) return <Navigate to="/marketing/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

// When embedded under the Admin CRM shell, tell it which page we're on so a
// refresh of the shell tab can put the iframe back here instead of always
// booting it back to the dashboard.
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
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadsBoard />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/webinars" element={<WebinarsList />} />
            <Route path="/webinars/:id" element={<WebinarDetail />} />
            <Route path="/events" element={<EventsList />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/ifo" element={<IfoList />} />
            <Route path="/settings" element={<Settings />} />

            <Route element={<ProtectedRoute allowedRoles={MANAGERS} />}>
              <Route path="/sales-team" element={<SalesTeamList />} />
              <Route path="/targets" element={<TargetsList />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/reports/calling" element={<CallingReport />} />
              <Route path="/reports/funnel" element={<FunnelReport />} />
              <Route path="/reports/receivables" element={<Receivables />} />
              <Route path="/reports/payment-delays" element={<PaymentDelays />} />
              <Route path="/review" element={<ReviewPage />} />
            </Route>
          </Route>
        </Route>

        {/* Marketing CRM section — separate backend account, separate guard
            (ProtectedMarketingRoute), same shared DashboardLayout chrome.
            font-marketing scopes these ported pages to their original
            typeface without changing the Sales CRM's default. */}
        <Route element={<ProtectedMarketingRoute />}>
          <Route element={<DashboardLayout />}>
            <Route
              path="/marketing/dashboard"
              element={<div className="font-marketing"><MarketingDashboard /></div>}
            />
            <Route
              path="/marketing/leads"
              element={<div className="font-marketing"><MarketingLeads /></div>}
            />
            <Route
              path="/marketing/fms"
              element={<div className="font-marketing"><MarketingFms /></div>}
            />
            <Route element={<ProtectedMarketingRoute adminOnly />}>
              <Route
                path="/marketing/users"
                element={<div className="font-marketing"><MarketingUsers /></div>}
              />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
