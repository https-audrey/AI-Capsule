import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In production Express serves the built files from client/dist (same origin as the API).
// In dev, Vite proxies /api to Express so cookies stay same-origin.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } } },
  test: { globals: true },
});
