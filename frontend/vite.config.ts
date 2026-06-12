import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  plugins: [react()],
  server: {
    fs: {
      allow: [".."],
    },
    proxy: {
      "/api": {
        changeOrigin: true,
        target: "http://localhost:4000",
      },
    },
  },
});
