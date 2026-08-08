import { DEFAULT_API_URL } from "./config";

/**
 * Single resolver for the backend base URL, checked in priority order:
 *  1. `localStorage["offroute.apiUrl"]` — runtime override, so a field
 *     device can be pointed at the command post's LAN address without a
 *     rebuild (set it from the devtools console or a future settings page).
 *  2. `VITE_API_URL` env var — build-time configuration.
 *  3. `DEFAULT_API_URL` from lib/config.ts — the dev default.
 */
export function getApiBaseUrl(): string {
  try {
    const override = localStorage.getItem("offroute.apiUrl");
    if (override?.trim()) return override.trim();
  } catch {
    // localStorage unavailable — fall through to env/default
  }
  return DEFAULT_API_URL;
}
