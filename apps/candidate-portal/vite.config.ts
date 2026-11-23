import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const rawTarget = env.API_ORIGIN || "http://127.0.0.1:4000";
  const apiTarget = rawTarget.replace("localhost", "127.0.0.1");
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
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (_err, _req, res) => {
              if (res && "writeHead" in res && !res.headersSent) {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Backend service unavailable, retrying..." }));
              }
            });
          },
        },
        "/auth/oidc": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (_err, _req, socket) => {
              if (socket && "destroy" in socket && !socket.destroyed) {
                socket.destroy();
              }
            });
            proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
              socket.on("error", () => {
                if (!socket.destroyed) socket.destroy();
              });
            });
          },
        },
      },
    },
    build: { sourcemap: true, chunkSizeWarningLimit: 1200 },
  };
});
