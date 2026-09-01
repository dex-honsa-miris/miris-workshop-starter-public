import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { mirisDevApi } from "./miris/devApi";

export default defineConfig(({ mode }) => {
  // loadEnv rather than process.env: Vite reads .env.local for the client, but
  // does not put it on process.env, and FAL_KEY must never reach the client.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), mirisDevApi(env)],
    server: {
      port: 3000,
      // strictPort so the workshop's own instructions stay true: if 3000 is
      // taken, fail loudly rather than silently moving to 3001.
      strictPort: true,
      // host so the dev server binds beyond localhost. In a WebContainer
      // (bolt.new, StackBlitz) the preview is proxied from outside the
      // process, and a localhost-only bind leaves it stuck on "Waiting for
      // preview to load" while the terminal happily reports Vite as ready.
      host: true,
    },
    preview: { port: 3000, strictPort: true, host: true },
    // The SDK ships prebuilt ESM with WASM alongside it. Leaving it out of
    // dependency pre-bundling keeps esbuild from rewriting the WASM fetch paths.
    optimizeDeps: { exclude: ["@miris-inc/core", "@miris-inc/three"] },
  };
});
