import { create } from "zustand";
import { getPersisted, setPersisted } from "@/lib/persist";

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
}

interface CachedLocation {
  label: string;
  lat: number;
  lon: number;
}

const STORAGE_KEY = "ranger:last-location";

function formatCoords(lat: number, lon: number) {
  const latHemi = lat >= 0 ? "N" : "S";
  const lonHemi = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latHemi} ${Math.abs(lon).toFixed(4)}°${lonHemi}`;
}

async function reverseGeocode(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
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
}));

let started = false;
let lastCoordsKey: string | null = null;
let geocodeAbort: AbortController | null = null;

function handleFix(lat: number, lon: number) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (key === lastCoordsKey) return;
  lastCoordsKey = key;

  useLocationStore.setState({
    status: "resolving",
    label: formatCoords(lat, lon),
    coords: { lat, lon },
  });

  geocodeAbort?.abort();
  geocodeAbort = new AbortController();

  reverseGeocode(lat, lon, geocodeAbort.signal)
    .then((place) => {
      const label = place ? place.toUpperCase() : formatCoords(lat, lon);
      useLocationStore.setState({ status: "ready", label, coords: { lat, lon } });
      void setPersisted<CachedLocation>(STORAGE_KEY, { label, lat, lon });
    })
    .catch(() => {
      const label = formatCoords(lat, lon);
      useLocationStore.setState({ status: "ready", label, coords: { lat, lon } });
      void setPersisted<CachedLocation>(STORAGE_KEY, { label, lat, lon });
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
    });
  }
}

function startWatching() {
  if (started) return;
  started = true;

  void loadCachedLabel();

  if (!navigator.geolocation) {
    useLocationStore.setState({ status: "unavailable", label: "LOCATION UNKNOWN" });
    return;
  }

  navigator.geolocation.watchPosition(
    (position) => handleFix(position.coords.latitude, position.coords.longitude),
    (error) => {
      useLocationStore.setState(
        error.code === error.PERMISSION_DENIED
          ? { status: "denied", label: "LOCATION ACCESS DENIED" }
          : { status: "unavailable", label: "LOCATION UNKNOWN" },
      );
    },
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
  );
}

/** Reads the shared location state, starting the GPS watch on first use. */
export function useDeviceLocation(): LocationState {
  startWatching();
  return useLocationStore();
}
