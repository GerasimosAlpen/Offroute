import { create } from "zustand";
import type { Ranger } from "@/lib/rangers";
import { fetchRoadRoute, buildFallbackRoute, animateRouteReveal } from "@/lib/routing";
import { evacuationApi } from "@/lib/api";
import { socket } from "@/lib/socket";
import { cacheGetAll, cacheSet } from "@/lib/offlineCache";
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
  /** Radar removes a point — it was wrong, or needs relocating (mark a new one afterward via the normal request/accept flow). */
  remove: (id: string) => Promise<void>;
}

// Rangers this client itself just `mark()`-ed, waiting to be matched against
// the `evac-confirmed` echo of its own `accept()` call (in
// evacuationRequests.ts). `mark()`'s local point never gets its temp id
// replaced with the server's real id anywhere in this file — the actual
// `POST /evacuation/accept/:id` call lives in evacuationRequests.ts, not
// here — so an id-only dedup check here can NEVER match, meaning every
// locally-marked point used to get added a second time the moment its own
// confirmation echo arrived. Found via manual testing (a real, always-on
// duplicate, not just an occasional race like the analogous fix in
// commsLog.ts/evacuationRequests.ts).
const pendingOwnPoints = new Set<string>();

export const useEvacuationPointsStore = create<EvacuationPointsState>((set, get) => {
  // Real-time: another client's accepted evacuation request shows up here too
  socket.on("evac-confirmed", (point: ApiEvacuationPoint) => {
    if (!point || typeof point.id !== "string") return; // malformed payload, ignore rather than throw

    if (pendingOwnPoints.has(point.rangerId)) {
      pendingOwnPoints.delete(point.rangerId);
      set((s) => ({
        points: s.points.map((p) =>
          p.rangerId === point.rangerId && p.id !== point.id
            ? { ...apiPointToLocal(point), route: p.route } // keep the route this tab already animated
            : p,
        ),
      }));
      return;
    }

    const exists = get().points.some((p) => p.id === point.id);
    if (!exists) set((s) => ({ points: [...s.points, apiPointToLocal(point)] }));
  });

  // Real-time: another client (or this one) removing/relocating a point
  socket.on("evac-removed", (payload: { id?: string }) => {
    if (!payload || typeof payload.id !== "string") return; // malformed payload, ignore rather than throw
    set((s) => ({ points: s.points.filter((p) => p.id !== payload.id) }));
  });

  return {
    points: [],
    loaded: false,

    loadPoints: async () => {
      if (get().loaded) return;
      try {
        const remote = await evacuationApi.points();
        const points = (remote as ApiEvacuationPoint[]).map(apiPointToLocal);
        set({ points, loaded: true });
        void cacheSet("evacuationPoints", points);
      } catch (err) {
        console.warn("[evacuationPoints] Failed to load from API:", err);
        const cached = await cacheGetAll<EvacuationPoint>("evacuationPoints");
        set({ points: cached, loaded: true });
      }
    },

    mark: async (incidentPos, ranger, at) => {
      const id = `${ranger.id}-${Date.now()}`;
      pendingOwnPoints.add(ranger.id);
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

    remove: async (id) => {
      const point = get().points.find((p) => p.id === id);
      // Optimistic removal — filtering out an id that's already gone (e.g.
      // the evac-removed echo arriving afterward) is a safe no-op, unlike
      // the add-path races elsewhere in this file, so no dedup bookkeeping
      // is needed here.
      set((s) => ({ points: s.points.filter((p) => p.id !== id) }));

      if (point) {
        useCommsLogStore.getState().append({
          sender: "PUSAT",
          color: "#ff0040",
          lead: "TITIK EVAKUASI DIHAPUS",
          body: `titik evakuasi ${point.rangerName} (${point.callsign}) dihapus/direlokasi.`,
        });
      }

      try {
        await evacuationApi.removePoint(id);
      } catch (err) {
        console.warn("[evacuationPoints] Failed to persist removal to backend:", err);
        // Keep it removed locally — an operator who removed a bad point
        // expects it gone regardless of backend reachability.
      }
    },
  };
});
