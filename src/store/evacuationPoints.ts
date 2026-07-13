import { create } from "zustand";
import type { Ranger } from "@/lib/rangers";
import { fetchRoadRoute, buildFallbackRoute, animateRouteReveal } from "@/lib/routing";
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

interface EvacuationPointsState {
  points: EvacuationPoint[];
  /**
   * A ranger pings wherever they're currently standing as a declared-safe
   * assembly point ("all the victims here are okay") — distinct from a
   * status message pin, this also draws a route from the incident to the
   * safe point so everyone can see how to get there.
   */
  mark: (incidentPos: [number, number], ranger: Ranger, at: [number, number]) => Promise<void>;
}

export const useEvacuationPointsStore = create<EvacuationPointsState>((set) => ({
  points: [],

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
}));
