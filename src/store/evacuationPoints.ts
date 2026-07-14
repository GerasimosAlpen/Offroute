import { create } from "zustand";
import type { Ranger } from "@/lib/rangers";
import { fetchRoadRoute, buildFallbackRoute, animateRouteReveal } from "@/lib/routing";
import { evacuationApi } from "@/lib/api";
import { socket } from "@/lib/socket";
import { useCommsLogStore } from "./commsLog";

export interface EvacuationPoint {
  id: string;
  rangerId: string;
  rangerName: string;
  callsign: string;
  lat: number;
  lon: number;
  /** Route from the incident to this safe point, revealed progressively — starts empty. */
  route: [number, number][];
  timestamp: number;
}

interface ApiEvacuationPoint {
  id: string;
  rangerId: string;
  rangerName: string;
  callsign: string;
  lat: number;
  lon: number;
  createdAt: string;
}

function apiPointToLocal(p: ApiEvacuationPoint): EvacuationPoint {
  return {
    id: p.id,
    rangerId: p.rangerId,
    rangerName: p.rangerName,
    callsign: p.callsign,
    lat: p.lat,
    lon: p.lon,
    // No incident-origin position is carried on the confirmed record itself,
    // so a point hydrated from the backend (or pushed via evac-confirmed
    // from another client) just shows as a marker — only the point *this*
    // browser tab itself walked through `mark()` gets the animated route.
    route: [],
    timestamp: new Date(p.createdAt).getTime(),
  };
}

interface EvacuationPointsState {
  points: EvacuationPoint[];
  loaded: boolean;
  loadPoints: () => Promise<void>;
  /**
   * A ranger pings wherever they're currently standing as a declared-safe
   * assembly point ("all the victims here are okay") — distinct from a
   * status message pin, this also draws a route from the incident to the
   * safe point so everyone can see how to get there.
   */
  mark: (incidentPos: [number, number], ranger: Ranger, at: [number, number]) => Promise<void>;
}

export const useEvacuationPointsStore = create<EvacuationPointsState>((set, get) => {
  // Real-time: another client's accepted evacuation request shows up here too
  socket.on("evac-confirmed", (point: ApiEvacuationPoint) => {
    const exists = get().points.some((p) => p.id === point.id);
    if (!exists) set((s) => ({ points: [...s.points, apiPointToLocal(point)] }));
  });

  return {
    points: [],
    loaded: false,

    loadPoints: async () => {
      if (get().loaded) return;
      try {
        const remote = await evacuationApi.points();
        set({ points: (remote as ApiEvacuationPoint[]).map(apiPointToLocal), loaded: true });
      } catch (err) {
        console.warn("[evacuationPoints] Failed to load from API:", err);
        set({ loaded: true });
      }
    },

    mark: async (incidentPos, ranger, at) => {
      const id = `${ranger.id}-${Date.now()}`;
      set((s) => ({
        points: [
          ...s.points,
          {
            id,
            rangerId: ranger.id,
            rangerName: ranger.name,
            callsign: ranger.callsign,
            lat: at[0],
            lon: at[1],
            route: [],
            timestamp: Date.now(),
          },
        ],
      }));

      useCommsLogStore.getState().append({
        sender: `${ranger.name} (${ranger.callsign})`,
        color: "#66df75",
        lead: "TITIK EVAKUASI",
        body: "lokasi ini ditandai aman, seluruh korban dalam kondisi baik.",
      });

      const route = (await fetchRoadRoute(incidentPos, at)) ?? buildFallbackRoute(incidentPos, at);
      await animateRouteReveal(route, 900, (partial) => {
        set((s) => ({ points: s.points.map((p) => (p.id === id ? { ...p, route: partial } : p)) }));
      });
    },
  };
});
