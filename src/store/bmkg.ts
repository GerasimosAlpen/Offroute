import { create } from "zustand";
import { BMKG_ENDPOINT } from "@/lib/config";
import { BMKG_POLL_MS } from "@/lib/timings";

export interface QuakeInfo {
  magnitude: number;
  depthKm: number;
  region: string;
  lat: number;
  lon: number;
  timeWIB: string;
  potential: string;
  felt: string;
}

interface BmkgState {
  status: "loading" | "ready" | "unavailable";
  quake: QuakeInfo | null;
}

/**
 * BMKG (Indonesia's meteorology/geophysics agency) publishes the latest
 * significant earthquake as a plain public JSON feed — no key, open CORS.
 * This is real data, refreshed periodically; contrast with the FLARE
 * sequence's simulated local drill, which borrows this feed's magnitude for
 * its HUD readouts but keeps the drill's epicenter position local (see
 * TODO.md — the real quake could be anywhere in Indonesia, not necessarily
 * near the ranger, so the drill can't honestly use its coordinates too).
 */
export const useBmkgStore = create<BmkgState>(() => ({
  status: "loading",
  quake: null,
}));

let started = false;

async function fetchLatestQuake() {
  try {
    const res = await fetch(BMKG_ENDPOINT);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const g = data?.Infogempa?.gempa;
    if (!g) throw new Error("unexpected response shape");

    const [lat, lon] = String(g.Coordinates).split(",").map(Number);
    const magnitude = parseFloat(g.Magnitude);
    const depthKm = parseFloat(g.Kedalaman);
    // A malformed field would otherwise publish NaN into the map/HUD —
    // treat it the same as an unavailable feed.
    if (![lat, lon, magnitude, depthKm].every(Number.isFinite)) {
      throw new Error("malformed quake fields");
    }
    useBmkgStore.setState({
      status: "ready",
      quake: {
        magnitude,
        depthKm,
        region: g.Wilayah,
        lat,
        lon,
        timeWIB: g.Jam,
        potential: g.Potensi,
        felt: g.Dirasakan ?? "",
      },
    });
  } catch {
    useBmkgStore.setState({ status: "unavailable", quake: null });
  }
}

function startPolling() {
  if (started) return;
  started = true;
  void fetchLatestQuake();
  setInterval(fetchLatestQuake, BMKG_POLL_MS);
}

export function useBmkgQuake(): BmkgState {
  startPolling();
  return useBmkgStore();
}
