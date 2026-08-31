import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { mirisDevApi } from "./miris/devApi";

export default defineConfig(({ mode }) => {
  // loadEnv rather than process.env: Vite reads .env.local for the client, but
  // does not put it on process.env, and FAL_KEY must never reach the client.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), mirisDevApi(env)],
    server: { port: 3000 },
    preview: { port: 3000 },
    // The SDK ships prebuilt ESM with WASM alongside it. Leaving it out of
    // dependency pre-bundling keeps esbuild from rewriting the WASM fetch paths.
    optimizeDeps: { exclude: ["@miris-inc/core", "@miris-inc/three"] },
  };
});
