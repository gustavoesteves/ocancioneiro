import react from "@vitejs/plugin-react";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

function copyImportRoute(): Plugin {
  return {
    name: "copy-import-route",
    closeBundle() {
      const importDirectory = join(process.cwd(), "github-pages", "import");
      mkdirSync(importDirectory, { recursive: true });
      copyFileSync(
        join(process.cwd(), "github-pages", "index.html"),
        join(importDirectory, "index.html"),
      );
    },
  };
}

export default defineConfig({
  base: "/ocancioneiro/",
  build: {
    emptyOutDir: true,
    outDir: "../github-pages",
  },
  plugins: [react(), copyImportRoute()],
  publicDir: "../public",
  root: "github-pages-src",
});
