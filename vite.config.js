import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  // Relative asset paths so the built site works in a CSS1 subfolder (e.g. ~/public_html/dialect-drift/).
  base: "./",
  server: { port: 5173 },
});
