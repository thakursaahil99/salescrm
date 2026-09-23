import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login.jsx";
import Layout from "./components/layout/Layout.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import LeadsPage from "./pages/leads/LeadsPage.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import UsersPage from "./pages/users/UsersPage.jsx";
import FmsPage from "./pages/fms/FmsPage.jsx";

export default function App() {
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
