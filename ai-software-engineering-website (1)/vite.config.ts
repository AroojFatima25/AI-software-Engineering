import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The app is a client-side router with two routes: "/" and "/workspace".
 * The build inlines everything into a single dist/index.html (single-file
 * plugin). Static hosts serve that file for "/" but return 404 for a direct
 * hit on "/workspace"; publishing the same shell as 404.html makes deep links
 * boot the SPA, which then renders the protected route (and redirects
 * signed-out visitors back to "/").
 */
function spa404Fallback(): Plugin {
  return {
    name: "ai-os-spa-404-fallback",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const index = path.join(outDir, "index.html");
      if (!fs.existsSync(index)) return;
      fs.copyFileSync(index, path.join(outDir, "404.html"));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), spa404Fallback()],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
