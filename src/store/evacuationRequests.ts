import { create } from "zustand";
import { RANGERS, type Ranger } from "@/lib/rangers";
import { evacuationApi, type CreateEvacRequestDto } from "@/lib/api";
import { socket } from "@/lib/socket";
import { cacheGetAll, cacheSet } from "@/lib/offlineCache";
import { useCommsLogStore } from "./commsLog";
import { useEvacuationPointsStore } from "./evacuationPoints";
import { raiseAlert } from "@/lib/alerts";

export interface EvacuationPingRequest {
  id: string;
  ranger: Ranger;
  at: [number, number];
  incidentPos: [number, number];
  timestamp: number;
}

interface ApiEvacuationRequest {
  id: string;
  rangerId: string;
  rangerName: string;
  callsign: string;
  atLat: number;
  atLon: number;
  incidentLat: number;
  incidentLon: number;
  accepted: boolean | null;
  createdAt: string;
}

/**
 * `EvacuationRequest` doesn't carry the ranger's map `offset` (it's not
 * FK'd to `Personnel` in the schema, just flat id/name/callsign strings) —
 * fall back to the static roster for that one field, same fallback already
 * used elsewhere when live and static ranger data need reconciling.
 */
function apiRequestToLocal(r: ApiEvacuationRequest): EvacuationPingRequest {
  const known = RANGERS.find((ranger) => ranger.id === r.rangerId);
  return {
    id: r.id,
    ranger: known ?? { id: r.rangerId, name: r.rangerName, callsign: r.callsign, offset: [0, 0] },
    at: [r.atLat, r.atLon],
    incidentPos: [r.incidentLat, r.incidentLon],
    timestamp: new Date(r.createdAt).getTime(),
  };
}

interface EvacuationRequestsState {
  pending: EvacuationPingRequest[];
  loaded: boolean;
  loadPending: () => Promise<void>;
  request: (ranger: Ranger, at: [number, number], incidentPos: [number, number]) => Promise<void>;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => void;
}

// Rangers this client itself just submitted a request for, waiting to be
// matched against their own echo off the socket — by rangerId (a ranger only
// ever has one open request at a time in this flow), not by exact id. The
// optimistic entry added in `request()` below is keyed by a temp local id;
// if the `evac-request` broadcast echo arrives before that same request's
// own HTTP response does (a real race — found via manual testing, the same
// class of bug already fixed in commsLog.ts), an id-only dedup check
// wrongly treats the echo as a brand-new request and adds a second card for
// the same ranger.
const pendingOwnRequests = new Set<string>();

export const useEvacuationRequestsStore = create<EvacuationRequestsState>((set, get) => {
  // Real-time: another client's evacuation ping shows up here too, awaiting the same accept/reject
  socket.on("evac-request", (req: ApiEvacuationRequest) => {
    if (!req || typeof req.id !== "string") return; // malformed payload, ignore rather than throw
    if (req.accepted !== null) return;

    if (pendingOwnRequests.has(req.rangerId)) {
      pendingOwnRequests.delete(req.rangerId);
      // Correct the optimistic entry's temp id to the real server id in
      // place, rather than adding a second entry for the same request.
      set((s) => ({
        pending: s.pending.map((p) => (p.ranger.id === req.rangerId && p.id !== req.id ? apiRequestToLocal(req) : p)),
      }));
      return;
    }

    const exists = get().pending.some((p) => p.id === req.id);
    if (!exists) {
      set((s) => ({ pending: [...s.pending, apiRequestToLocal(req)] }));
      raiseAlert("Permintaan evakuasi baru", `${req.rangerName} (${req.callsign}) mengajukan titik evakuasi.`);
    }
  });

  return {
    pending: [],
    loaded: false,

    loadPending: async () => {
      if (get().loaded) return;
      try {
        const remote = await evacuationApi.pending();
        const pending = (remote as ApiEvacuationRequest[]).map(apiRequestToLocal);
        set({ pending, loaded: true });
        void cacheSet("evacuationRequests", pending);
      } catch (err) {
        console.warn("[evacReq] Failed to load pending from API:", err);
        const cached = await cacheGetAll<EvacuationPingRequest>("evacuationRequests");
        set({ pending: cached, loaded: true });
      }
    },

    request: async (ranger, at, incidentPos) => {
      const id = `${ranger.id}-${Date.now()}`;
      // Optimistic add
      set((s) => ({ pending: [...s.pending, { id, ranger, at, incidentPos, timestamp: Date.now() }] }));
      pendingOwnRequests.add(ranger.id);

      useCommsLogStore.getState().append({
        sender: `${ranger.name} (${ranger.callsign})`,
        color: "#66df75",
        lead: "AJUKAN TITIK EVAKUASI",
        body: "mengajukan lokasi ini sebagai titik evakuasi aman — menunggu konfirmasi PUSAT.",
      });

      try {
        const dto: CreateEvacRequestDto = {
          rangerId: ranger.id,
          rangerName: ranger.name,
          callsign: ranger.callsign,
          atLat: at[0],
          atLon: at[1],
          incidentLat: incidentPos[0],
          incidentLon: incidentPos[1],
        };
        const saved = await evacuationApi.request(dto);
        pendingOwnRequests.delete(ranger.id);
        // Replace local optimistic ID with server-assigned ID
        set((s) => ({
          pending: s.pending.map((p) => (p.id === id ? { ...p, id: saved.id } : p)),
        }));
      } catch (err) {
        pendingOwnRequests.delete(ranger.id);
        console.warn("[evacReq] Failed to persist request to backend:", err);
      }
    },

    accept: async (id) => {
      const req = get().pending.find((p) => p.id === id);
      if (!req) return;
      set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
      await useEvacuationPointsStore.getState().mark(req.incidentPos, req.ranger, req.at);

      try {
        await evacuationApi.accept(id);
      } catch (err) {
        console.warn("[evacReq] Failed to persist accept to backend:", err);
      }
    },

    reject: (id) => {
      const req = get().pending.find((p) => p.id === id);
      if (!req) return;
      set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
      useCommsLogStore.getState().append({
        sender: "PUSAT",
        color: "#ff0040",
        lead: "TITIK EVAKUASI DITOLAK",
        body: `permintaan ${req.ranger.name} (${req.ranger.callsign}) ditolak, cari titik lain.`,
      });

      evacuationApi.reject(id).catch((err) =>
        console.warn("[evacReq] Failed to persist reject to backend:", err),
      );
    },
  };
});
