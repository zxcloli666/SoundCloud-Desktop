import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig(async () => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
        // Two HTML entries: the main app + the lightweight tray-popover mini-player.
        input: {
            main: "index.html",
            tray: "tray.html",
        },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack/react-query") || id.includes("@tanstack/react-virtual")) {
            return "tanstack";
          }
          if (id.includes("@dnd-kit")) return "dnd-kit";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          if (id.includes("lucide-react") || id.includes("simple-icons")) return "icons";
          if (id.includes("react-markdown")) return "markdown";
          if (id.includes("@tauri-apps")) return "tauri";
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
