import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const apiTarget = env.API_ORIGIN || "http://localhost:4000";
  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, "../.."),
    define: {
      "import.meta.env.ADMIN_EMAIL": JSON.stringify(env.ADMIN_EMAIL || env.VITE_ADMIN_EMAIL || ""),
      "import.meta.env.ADMIN_PASSWORD": JSON.stringify(env.ADMIN_PASSWORD || env.VITE_ADMIN_PASSWORD || ""),
      "import.meta.env.VITE_ADMIN_EMAIL": JSON.stringify(env.VITE_ADMIN_EMAIL || env.ADMIN_EMAIL || ""),
      "import.meta.env.VITE_ADMIN_PASSWORD": JSON.stringify(env.VITE_ADMIN_PASSWORD || env.ADMIN_PASSWORD || ""),
    },
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: false },
        "/socket.io": { target: apiTarget, ws: true, changeOrigin: false },
      },
    },
    build: { sourcemap: true, chunkSizeWarningLimit: 1200 },
  };
});
