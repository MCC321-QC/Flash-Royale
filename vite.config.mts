import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themeCssScales from "./scripts/theme-css-scales.cjs";

export default defineConfig({
  plugins: [themeCssScales.themeCssScalesPlugin(), react()],
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/library/**"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: { app: "index.html", keyboard: "keyboard.html" },
    },
    chunkSizeWarningLimit: 1700,
  },
});
