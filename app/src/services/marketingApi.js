import axios from "axios";

// The Marketing CRM half of the combined backend, mounted at /marketing on
// the one Render service. VITE_MARKETING_API_URL is that service's base URL
// (see .env.example); "/api" is appended here to match the Marketing CRM's
// own route shape (POST /marketing/api/auth/login, etc.).
const marketingApi = axios.create({
  baseURL: `${import.meta.env.VITE_MARKETING_API_URL || "/marketing"}/api`,
});

// Same sessionStorage keys the standalone Marketing CRM client used.
marketingApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("mcrm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 means this token specifically is missing/expired/invalid — clear
// just the Marketing half of the session and bounce to login. (The Sales
// half, if any, is untouched; logging back in re-tries both.)
marketingApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== "/login") {
      sessionStorage.removeItem("mcrm_token");
      sessionStorage.removeItem("mcrm_user");
      window.location.href = "/login";
    }
    return Promise.reject(err.response?.data?.message || err.message);
  }
);

export default marketingApi;
