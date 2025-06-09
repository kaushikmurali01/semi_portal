// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Optional: only use cartographer in Replit (skip if you're not using Replit)
const isReplit = process.env.REPL_ID !== undefined;
const isDev = process.env.NODE_ENV !== "production";

// Only include cartographer conditionally (no await!)
const plugins = [
  react(),
  runtimeErrorOverlay(),
];

if (isDev && isReplit) {
  const cartographer = require("@replit/vite-plugin-cartographer").cartographer;
  plugins.push(cartographer());
}

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
