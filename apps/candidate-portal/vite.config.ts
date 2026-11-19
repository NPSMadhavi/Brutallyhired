import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const apiTarget = env.API_ORIGIN || "http://localhost:4000";
  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, "../.."),
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: false },
        "/socket.io": { target: apiTarget, ws: true, changeOrigin: false },
      },
    },
    build: { sourcemap: true, chunkSizeWarningLimit: 1200 },
  };
});
