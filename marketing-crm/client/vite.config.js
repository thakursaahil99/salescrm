import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6173,
    host: true,
    proxy: {
      "/api": "http://localhost:6050",
      "/socket.io": { target: "http://localhost:6050", ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Splits the one ~800KB bundle into cacheable pieces: vendor code (which
        // rarely changes) stays cached across deploys instead of being
        // re-downloaded every time app code changes.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
});
