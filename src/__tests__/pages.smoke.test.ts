import { describe, expect, it } from "vitest";

/**
 * Import-time smoke tests for every persona surface.
 *
 * Why these earn their place: this is a Preact app, but 17 files import
 * `react-leaflet` and 33 import `framer-motion` — React-ecosystem packages that
 * only work because `react`/`react-dom` are aliased to `preact/compat` in both
 * vite.config.ts and tsconfig.json. react-leaflet 4.x in particular is pinned to
 * React 18 semantics. If that aliasing breaks, or a dependency bump stops
 * tolerating the shim, the failure surfaces the moment the module graph is
 * evaluated — long before any assertion about rendered output.
 *
 * These deliberately assert on the module, not the DOM. Fully rendering the
 * radar console would need a live backend, a socket server, Leaflet tiles and
 * a real geolocation provider; a test that mocks all of that tests the mocks.
 * Importing the page pulls in its entire transitive graph — every store, every
 * map component, every icon — which is exactly the fragile part.
 */

const surfaces = [
  { name: "Warga (citizen)", route: "/user", load: () => import("@/user/UserPage") },
  {
    name: "Personel lapangan (field personnel)",
    route: "/ranger/personel",
    load: () => import("@/ranger/personel/PersonelPage"),
  },
  {
    name: "Ranger Command (operator console)",
    route: "/ranger/radar",
    load: () => import("@/ranger/radar/RadarPage"),
  },
  { name: "SOS (anonymous victim beacon)", route: "/sos", load: () => import("@/ranger/sos/SosPage") },
] as const;

describe("persona pages", () => {
  for (const surface of surfaces) {
    it(`${surface.name} at ${surface.route} imports cleanly`, async () => {
      const mod = await surface.load();
      expect(mod.default).toBeTypeOf("function");
    });
  }
});

describe("app shell", () => {
  it("App imports and exports a component", async () => {
    const mod = await import("@/App");
    expect(mod.default).toBeTypeOf("function");
  });
});

describe("preact/compat aliasing", () => {
  // If these resolve to real React instead of the compat shim, the app ships
  // two rendering libraries and hooks break in confusing, intermittent ways.
  it("aliases react to preact/compat", async () => {
    const react = await import("react");
    const preact = await import("preact/compat");
    expect(react.useState).toBe(preact.useState);
  });

  it("aliases react-dom to preact/compat", async () => {
    const reactDom = await import("react-dom");
    const preact = await import("preact/compat");
    expect(reactDom.createPortal).toBe(preact.createPortal);
  });

  it("lets react-leaflet load under the shim", async () => {
    const mod = await import("react-leaflet");
    expect(mod.MapContainer).toBeDefined();
    expect(mod.TileLayer).toBeDefined();
  });
});

describe("core infrastructure modules", () => {
  it("resolves the backend base URL with a sane default", async () => {
    const { getApiBaseUrl } = await import("@/lib/apiBase");
    const url = getApiBaseUrl();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("reports not-Tauri when running under jsdom", async () => {
    const { isTauri } = await import("@/lib/tauri");
    expect(isTauri).toBe(false);
  });
});
