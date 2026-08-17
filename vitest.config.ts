import path from "node:path";
import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

/**
 * Test config, kept separate from vite.config.ts because that one is an async
 * factory (it reads TAURI_DEV_HOST) and pulls in the Tailwind plugin, neither
 * of which a test run needs.
 *
 * The alias block below MUST stay in sync with vite.config.ts. It is the whole
 * point of the smoke tests: this app is Preact, but 17 files import
 * `react-leaflet` and 33 import `framer-motion`, and both only work because
 * `react` is aliased to `preact/compat`. If that aliasing ever breaks, the
 * failure shows up at module-import time — which is exactly what
 * src/__tests__/pages.smoke.test.ts catches.
 */
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      react: "preact/compat",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // On an exFAT volume macOS drops an AppleDouble "._name" sidecar next to
    // every file. They are binary, so esbuild chokes on them if they get
    // globbed as test files.
    exclude: ["**/node_modules/**", "**/dist/**", "**/._*"],
    // Leaflet and the map components are heavy to import; the default 5s is
    // tight on a cold CI runner.
    testTimeout: 20_000,
  },
});
