import { create } from "zustand";
import type { Ranger } from "@/lib/rangers";
import { evacuationApi, type CreateEvacRequestDto } from "@/lib/api";
import { useCommsLogStore } from "./commsLog";
import { useEvacuationPointsStore } from "./evacuationPoints";

export interface EvacuationPingRequest {
  id: string;
  ranger: Ranger;
  at: [number, number];
  incidentPos: [number, number];
  timestamp: number;
}

interface EvacuationRequestsState {
  pending: EvacuationPingRequest[];
  request: (ranger: Ranger, at: [number, number], incidentPos: [number, number]) => Promise<void>;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => void;
}

export const useEvacuationRequestsStore = create<EvacuationRequestsState>((set, get) => ({
  pending: [],

  request: async (ranger, at, incidentPos) => {
    const id = `${ranger.id}-${Date.now()}`;
    // Optimistic add
    set((s) => ({ pending: [...s.pending, { id, ranger, at, incidentPos, timestamp: Date.now() }] }));

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
      // Replace local optimistic ID with server-assigned ID
      set((s) => ({
        pending: s.pending.map((p) => (p.id === id ? { ...p, id: saved.id } : p)),
      }));
    } catch (err) {
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
}));
