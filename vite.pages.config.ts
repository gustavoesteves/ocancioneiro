import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/ocancioneiro/",
  build: {
    emptyOutDir: true,
    outDir: "../github-pages",
  },
  plugins: [react()],
  publicDir: "../public",
  root: "github-pages-src",
});
