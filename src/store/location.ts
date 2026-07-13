import { create } from "zustand";

export type GeoStatus =
  | "cached"
  | "locating"
  | "resolving"
  | "ready"
  | "denied"
  | "unavailable";

interface LocationState {
  status: GeoStatus;
  /** Human-readable place name once resolved, a status message otherwise. */
  label: string;
}

const STORAGE_KEY = "ranger:last-location";

function readCachedLabel(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.label === "string" ? parsed.label : null;
  } catch {
    return null;
  }
}

function writeCachedLabel(label: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ label }));
  } catch {
    // storage unavailable/full — cache is a nice-to-have, not load-bearing
  }
}

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

const cachedLabel = readCachedLabel();

/**
 * Live device location, shared app-wide. GPS is requested once (module-level
 * guard below) no matter how many components read this store, and every
 * reader sees the same watch instead of each mounting its own — this is
 * meant to run for the whole app session, not per-component.
 *
 * Starts from the last resolved location (localStorage) instead of a blank
 * "locating" state when one's available, so the UI paints instantly on
 * every launch instead of waiting on a fresh GPS fix + geocode round trip.
 * The real watch still kicks off underneath and corrects it once it lands.
 */
export const useLocationStore = create<LocationState>(() =>
  cachedLabel
    ? { status: "cached", label: cachedLabel }
    : { status: "locating", label: "Acquiring GPS lock..." },
);

let started = false;
let lastCoordsKey: string | null = null;

function startWatching() {
  if (started) return;
  started = true;

  if (!navigator.geolocation) {
    useLocationStore.setState({ status: "unavailable", label: "LOCATION UNKNOWN" });
    return;
  }

  let abort: AbortController | null = null;

  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude: lat, longitude: lon } = position.coords;
      const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      if (key === lastCoordsKey) return;
      lastCoordsKey = key;

      useLocationStore.setState({
        status: "resolving",
        label: formatCoords(lat, lon),
      });

      abort?.abort();
      abort = new AbortController();

      reverseGeocode(lat, lon, abort.signal)
        .then((place) => {
          const label = place ? place.toUpperCase() : formatCoords(lat, lon);
          useLocationStore.setState({ status: "ready", label });
          writeCachedLabel(label);
        })
        .catch(() => {
          const label = formatCoords(lat, lon);
          useLocationStore.setState({ status: "ready", label });
          writeCachedLabel(label);
        });
    },
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
