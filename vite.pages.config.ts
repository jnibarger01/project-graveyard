import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Deliberately separate from vite.config.ts: Pages is a client-only demo.
export default defineConfig({
  base: "/project-graveyard/",
  plugins: [tailwindcss(), react()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    rollupOptions: { input: "pages.html" },
  },
});
