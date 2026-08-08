/**
 * Central configuration for the Offroute frontend.
 * Values follow the same resolver pattern as `apiBase.ts`: an env override
 * (`import.meta.env.VITE_*`) wins, otherwise the baked-in default applies.
 *
 * This module is for operational config only. Simulated/example disaster
 * data (HAZARDS, the ranger roster, the quake drill choreography) stays in
 * `lib/hazards.ts`, `lib/rangers.ts`, and the flare/`peta-taktis` modules —
 * those are intentionally hardcoded examples of "what happens during a
 * disaster" and are NOT to be moved here.
 */

function env(name: string, fallback: string): string {
  const v = import.meta.env[name] as string | undefined;
  return v?.trim() ? v.trim() : fallback;
}

export const APP_NAME = "Offroute";
export const APP_VERSION = "0.1.0";

export const DEFAULT_API_URL = env("VITE_API_URL", "http://localhost:3000");

/** Dark tactical basemap used by the map views. */
export const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
/** Standard OSM tiles (demo playground only). */
export const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Jakarta — map fallback center before GPS/IP positioning resolves. */
export const DEFAULT_COORDS: [number, number] = [-6.1818, 106.8223];
/** Demo-playground map center. */
export const DEMO_COORDS: [number, number] = [-6.1754, 106.8272];

/** Local SQLite database used by tauri-plugin-sql (offline cache + demo). */
export const DB_NAME = "sqlite:offroute.db";

/** BMKG (Indonesia's meteorology/geophysics agency) latest-quake feed. */
export const BMKG_ENDPOINT = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json";
/** OSRM public routing API (demo-grade — see the TODO in lib/routing.ts). */
export const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
export const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
/** Free, keyless, CORS-open IP geolocation providers, tried in order. */
export const IP_GEO_PROVIDERS = ["https://ipwho.is/", "https://ipapi.co/json/"];

/** Address-bar search fallback in the embedded radar browser. */
export const WEB_SEARCH_URL = "https://www.google.com/search?q=";

/** Indonesia's unified national emergency number — a real tel: target. */
export const EMERGENCY_TEL = "112";

export interface EmergencyContact {
  name: string;
  number: string;
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { name: "Pusat Komando", number: "112" },
  { name: "Ambulans", number: "118" },
  { name: "Pemadam Kebakaran", number: "113" },
  { name: "SAR Nasional", number: "115" },
];
