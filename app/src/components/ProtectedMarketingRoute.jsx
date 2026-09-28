import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Mirrors ProtectedRoute.jsx but gates on the Marketing CRM side of the
// login instead of the Sales side — this app's two sections have separate
// backend accounts, so each needs its own guard. Someone logged in on Sales
// only, trying to reach a Marketing route, is bounced to their own
// dashboard rather than back to /login (they ARE logged in, just not here).
export default function ProtectedMarketingRoute({ adminOnly }) {
  const { user, marketing, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }
  if (!marketing.user) {
    if (user) return <Navigate to="/dashboard" replace />;
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (adminOnly && marketing.user.role !== "admin") {
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
}
