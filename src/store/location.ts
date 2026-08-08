import { create } from "zustand";
import { getPersisted, setPersisted } from "@/lib/persist";
import { formatCoords } from "@/lib/format";
import { NOMINATIM_ENDPOINT, IP_GEO_PROVIDERS } from "@/lib/config";
import { IP_FALLBACK_DELAY_MS } from "@/lib/timings";
import { watchPosition as tauriWatchPosition, checkPermissions, requestPermissions } from "@tauri-apps/plugin-geolocation";

export type GeoStatus =
  | "cached"
  | "locating"
  | "resolving"
  | "ready"
  | "denied"
  | "unavailable";

interface Coords {
  lat: number;
  lon: number;
}

interface LocationState {
  status: GeoStatus;
  /** Human-readable place name once resolved, a status message otherwise. */
  label: string;
  /** Raw coordinates, once a fix has actually landed — for anything that needs to plot a point (the tactical map), not just display text. */
  coords: Coords | null;
  /**
   * How the fix was obtained. `"gps"` is a precise device fix; `"ip"` is
   * city-level approximation (clearly labeled, never persisted as GPS);
   * `"manual"` is an operator-set override.
   */
  source: "gps" | "ip" | "manual" | null;
}

interface CachedLocation {
  label: string;
  lat: number;
  lon: number;
}

const STORAGE_KEY = "ranger:last-location";

async function reverseGeocode(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<string | null> {
  const url = `${NOMINATIM_ENDPOINT}?format=jsonv2&zoom=10&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const a = data?.address ?? {};
  const place =
    a.city ??
    a.town ??
    a.municipality ??
    a.village ??
    a.suburb ??
    a.county ??
    a.state;
  return typeof place === "string" ? place : null;
}

/**
 * Live device location, shared app-wide. GPS is requested once (module-level
 * guard below) no matter how many components read this store, and every
 * reader sees the same watch instead of each mounting its own — this is
 * meant to run for the whole app session, not per-component.
 */
export const useLocationStore = create<LocationState>(() => ({
  status: "locating",
  label: "Acquiring GPS lock...",
  coords: null,
  source: null,
}));

let started = false;
let lastCoordsKey: string | null = null;
let geocodeAbort: AbortController | null = null;
// True once a real GPS fix lands — so the approximate IP fallback can't
// clobber precise coordinates that arrive later.
let hasLiveFix = false;
let ipTried = false;

/**
 * IP-based approximate location — the reliable fallback when the browser
 * Geolocation API is unavailable or denied. This is the fix for radar in the
 * Tauri desktop build specifically: WKWebView on macOS (and WebView2/WebKitGTK
 * elsewhere) frequently never surfaces the OS geolocation prompt, so
 * `watchPosition` silently yields nothing. IP geo gives a real city-level
 * position, which is exactly right for a stationary command console. Precise
 * GPS still takes over automatically if it ever succeeds.
 */
// Free, keyless, CORS-open IP geolocation providers (see lib/config.ts) —
// a second one covers the first being rate-limited/down (ipapi.co paywalls
// quickly, so ipwho.is leads).
async function ipGeolocate(): Promise<{ lat: number; lon: number } | null> {
  for (const url of IP_GEO_PROVIDERS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const d = await res.json();
      // Both providers expose `latitude`/`longitude`; ipwho.is flags failure
      // with `success: false`.
      if (d?.success === false) continue;
      const lat = Number(d.latitude);
      const lon = Number(d.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)) {
        return { lat, lon };
      }
    } catch {
      // try the next provider
    }
  }
  return null;
}

async function tryIpFallback() {
  if (hasLiveFix || ipTried) return;
  ipTried = true;
  const ip = await ipGeolocate();
  if (hasLiveFix) return; // a precise fix landed while we were fetching
  if (ip) {
    handleFix(ip.lat, ip.lon, "ip");
  } else if (!useLocationStore.getState().coords) {
    useLocationStore.setState({ status: "unavailable", label: "LOCATION UNKNOWN" });
  }
}

/**
 * Records a fix. `source` tracks how the fix was obtained: an IP-derived
 * position is a city-level approximation and — unlike a real GPS fix — never
 * persisted to the cached-location slot (a stale approximate coordinate used
 * to masquerade as a precise saved position on the next launch).
 */
function handleFix(lat: number, lon: number, source: "gps" | "ip" = "gps") {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (key === lastCoordsKey) return;
  lastCoordsKey = key;

  useLocationStore.setState({
    status: "resolving",
    label: formatCoords(lat, lon),
    coords: { lat, lon },
    source,
  });

  geocodeAbort?.abort();
  geocodeAbort = new AbortController();

  reverseGeocode(lat, lon, geocodeAbort.signal)
    .then((place) => {
      const label = place ? place.toUpperCase() : formatCoords(lat, lon);
      useLocationStore.setState({ status: "ready", label, coords: { lat, lon }, source });
      if (source === "gps") void setPersisted<CachedLocation>(STORAGE_KEY, { label, lat, lon });
    })
    .catch(() => {
      const label = formatCoords(lat, lon);
      useLocationStore.setState({ status: "ready", label, coords: { lat, lon }, source });
      if (source === "gps") void setPersisted<CachedLocation>(STORAGE_KEY, { label, lat, lon });
    });
}

/**
 * Loads the last resolved location from disk (Tauri store, or localStorage
 * outside Tauri) so the UI paints something real instead of "Acquiring GPS
 * lock..." on every launch. Guarded so it can't clobber a fresher live fix
 * that resolved first.
 */
async function loadCachedLabel() {
  const cached = await getPersisted<CachedLocation>(STORAGE_KEY);
  if (cached && useLocationStore.getState().status === "locating") {
    useLocationStore.setState({
      status: "cached",
      label: cached.label,
      coords: { lat: cached.lat, lon: cached.lon },
      source: "gps",
    });
  }
}

async function startWatching() {
  if (started) return;
  started = true;

  void loadCachedLabel();

  // 1. Native Tauri App (Desktop/Mobile)
  if ("__TAURI_INTERNALS__" in window) {
    try {
      let perms = await checkPermissions();
      if (perms.location !== "granted") {
        perms = await requestPermissions(["location"]);
      }
      
      if (perms.location === "granted" || perms.location === "prompt-with-rationale") {
        // Start native GPS tracking
        await tauriWatchPosition(
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
          (position) => {
            if (position) {
              hasLiveFix = true;
              handleFix(position.coords.latitude, position.coords.longitude);
            }
          }
        );
        setTimeout(() => void tryIpFallback(), IP_FALLBACK_DELAY_MS);
        return;
      }
    } catch (err) {
      console.warn("Native geolocation failed:", err);
    }
    
    // Fallback to IP if permissions denied or plugin fails
    void tryIpFallback();
    return;
  }

  // 2. Standard Web Browser
  if (!navigator.geolocation || navigator.userAgent.toLowerCase().includes("android")) {
    void tryIpFallback();
    return;
  }

  navigator.geolocation.watchPosition(
    (position) => {
      hasLiveFix = true;
      handleFix(position.coords.latitude, position.coords.longitude);
    },
    () => {
      // Any geolocation failure (denied, timeout) falls back to approximate IP location
      void tryIpFallback();
    },
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
  );

  // watchPosition can hang without ever firing either callback in some
  // webviews — so kick the IP fallback after a short wait
  // regardless, guarded so a real fix always wins.
  setTimeout(() => void tryIpFallback(), IP_FALLBACK_DELAY_MS);
}

/** Reads the shared location state, starting the GPS watch on first use. */
export function useDeviceLocation(): LocationState {
  startWatching();
  return useLocationStore();
}

/**
 * Manual override — the fallback when GPS genuinely isn't available (e.g.
 * Tauri's WKWebView on macOS can fail to even surface the OS permission
 * prompt, a `wry` limitation, not something an Info.plist entry alone
 * fixes). Radar is a stationary command post anyway, so a one-time manual
 * "set base position" is a reasonable substitute, not just a workaround —
 * it doesn't need continuous tracking the way a field ranger's phone does.
 */
export function setManualLocation(lat: number, lon: number, label?: string) {
  lastCoordsKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const resolvedLabel = label?.trim() || formatCoords(lat, lon);
  useLocationStore.setState({ status: "ready", label: resolvedLabel, coords: { lat, lon }, source: "manual" });
  void setPersisted<CachedLocation>(STORAGE_KEY, { label: resolvedLabel, lat, lon });
}
