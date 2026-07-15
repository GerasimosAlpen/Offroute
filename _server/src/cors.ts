/**
 * Single source for the allowed frontend origins — used by both the HTTP
 * CORS config (main.ts) and the Socket.IO gateway, so the two can't drift.
 *
 * Extendable via the CORS_ORIGINS env var (comma-separated), so field
 * devices on a LAN (e.g. `http://192.168.1.10:1420`) can reach the command
 * post's server without a code change.
 */
const DEFAULT_ORIGINS = ["http://localhost:1420", "tauri://localhost"];

export const CORS_ORIGINS = [
  ...DEFAULT_ORIGINS,
  ...(process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
];
