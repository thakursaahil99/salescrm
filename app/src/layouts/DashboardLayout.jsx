import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import AskAssistant from "../components/AskAssistant.jsx";
import { NotificationProvider } from "../context/NotificationContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function Shell({ mobileOpen, setMobileOpen }) {
  return (
    <>
      <div className="flex h-dvh bg-surface overflow-hidden">
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <AskAssistant />
    </>
  );
}

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // NotificationProvider and AskAssistant both call Sales CRM endpoints
  // (/api/reminders/due, /api/assistant/chat). A visitor with no Sales
  // account has no Sales token to call them with — mounting them anyway
  // would 401 and (via the Sales api client's interceptor) bounce a
  // perfectly-logged-in Marketing-only visitor straight back to /login.
  const { user } = useAuth();

  if (!user) return <Shell mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />;
  return (
    <NotificationProvider>
      <Shell mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
    </NotificationProvider>
  );
}
