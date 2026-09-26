import { NavLink, Outlet } from "react-router-dom";
import { LayoutList, PieChart, Users, LogOut, Workflow } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import NotificationBell from "./NotificationBell.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const isElevated = user?.role === "admin" || user?.role === "manager";

  const tabClass = ({ isActive }) =>
    `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
      isActive ? "bg-brand text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center font-bold shadow-xs">
              RB
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight tracking-tight">Marketing CRM</p>
              <p className="text-[11px] text-gray-400 leading-tight">RedBean Hospitality</p>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1">
            <NavLink to="/leads" className={tabClass}>
              <LayoutList size={16} /> Leads
            </NavLink>
            <NavLink to="/dashboard" className={tabClass}>
              <PieChart size={16} /> Dashboard
            </NavLink>
            <NavLink to="/fms" className={tabClass}>
              <Workflow size={16} /> FMS
            </NavLink>
            {isElevated && (
              <NavLink to="/users" className={tabClass}>
                <Users size={16} /> Users
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.username}</p>
              <p className="text-[11px] text-gray-400 leading-tight capitalize">{user?.role}</p>
            </div>
            <button onClick={logout} className="btn-icon" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <nav className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          <NavLink to="/leads" className={(a) => tabClass(a) + " shrink-0"}>
            <LayoutList size={16} /> Leads
          </NavLink>
          <NavLink to="/dashboard" className={(a) => tabClass(a) + " shrink-0"}>
            <PieChart size={16} /> Dashboard
          </NavLink>
          <NavLink to="/fms" className={(a) => tabClass(a) + " shrink-0"}>
            <Workflow size={16} /> FMS
          </NavLink>
          {isElevated && (
            <NavLink to="/users" className={(a) => tabClass(a) + " shrink-0"}>
              <Users size={16} /> Users
            </NavLink>
          )}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
