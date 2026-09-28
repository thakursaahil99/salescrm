import { useAuth as useSharedAuth } from "../context/AuthContext.jsx";

// Presents the Marketing side of the app's shared (dual-backend)
// AuthContext in the exact shape marketing-crm/client's pages already
// expect — { user, loading, login, logout } — so those ported pages didn't
// need their bodies touched, only this import swapped in for their old
// context/AuthContext.jsx.
export function useAuth() {
  const { marketing, login, logout } = useSharedAuth();
  return { user: marketing.user, loading: marketing.loading, login, logout };
}
