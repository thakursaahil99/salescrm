import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the API through a RELATIVE path (`/api`, see
// services/api.js). In dev, Vite proxies that to the local backend on :5000.
// This is what makes port-sharing work: when you expose :5173 over a tunnel
// (ngrok, VS Code port forward, cloudflared…) a visitor's browser hits
// `<tunnel-url>/api/...`, Vite forwards it to your backend server-side, and
// nobody's browser ever needs to reach `localhost:5000` (which, on their
// machine, is *their* computer — the old cause of "Network Error" on login).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 6175,
    host: true, // listen on 0.0.0.0 so tunnels / LAN can reach it
    allowedHosts: true, // accept the tunnel's hostname
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:6100",
        changeOrigin: true,
        xfwd: true, // pass the real client IP through so the API's rate-limiter keys per visitor
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Splits the bundle so vendor code (rarely changes) stays cached across
        // deploys, and heavy libs used on only a few pages (PDF/Excel export,
        // charts) don't inflate the bundle everyone downloads on first load.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-export": ["jspdf", "jspdf-autotable"],
        },
      },
    },
  },
});
