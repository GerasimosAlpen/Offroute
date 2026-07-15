/**
 * Shared display formatting — the single home for coordinate/age/distance
 * strings that used to be re-implemented per component.
 */

/** `6.1818°S 106.8223°E` — hemisphere-labelled coordinates. */
export function formatCoords(lat: number, lon: number): string {
  const latHemi = lat >= 0 ? "N" : "S";
  const lonHemi = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latHemi} ${Math.abs(lon).toFixed(4)}°${lonHemi}`;
}

/** `42 detik lalu` / `3 menit lalu` — relative age of a past timestamp (ms). */
export function formatRelativeAge(thenMs: number, nowMs: number = Date.now()): string {
  const secs = Math.floor((nowMs - thenMs) / 1000);
  if (secs < 60) return `${secs} detik lalu`;
  return `${Math.floor(secs / 60)} menit lalu`;
}

/** `340 m` / `1.2 km` — human distance from meters. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
