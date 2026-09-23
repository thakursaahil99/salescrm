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
});
