import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client runs on 5173 (matching the original design) and proxies API +
// WebSocket traffic to the ECHO core on 3001.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
