import { create } from "zustand";
import type { Ranger } from "@/lib/rangers";
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
  /**
   * Personel-side action, "if they want to" — ranger offers their own
   * current position as a safe evacuation point. Scoped to major emergencies
   * only (earthquake/tsunami/typhoon drill via FlareSequence), never minor
   * ad-hoc hazards. No personel app exists yet (README's platform decision
   * is still open), so this stands in for a ranger tapping that offer on
   * their own device — radar still has to accept or reject before anything
   * is pinned to the map.
   */
  request: (ranger: Ranger, at: [number, number], incidentPos: [number, number]) => void;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => void;
}

export const useEvacuationRequestsStore = create<EvacuationRequestsState>((set, get) => ({
  pending: [],

  request: (ranger, at, incidentPos) => {
    const id = `${ranger.id}-${Date.now()}`;
    set((s) => ({ pending: [...s.pending, { id, ranger, at, incidentPos, timestamp: Date.now() }] }));
    useCommsLogStore.getState().append({
      sender: `${ranger.name} (${ranger.callsign})`,
      color: "#66df75",
      lead: "AJUKAN TITIK EVAKUASI",
      body: "mengajukan lokasi ini sebagai titik evakuasi aman — menunggu konfirmasi PUSAT.",
    });
  },

  accept: async (id) => {
    const req = get().pending.find((p) => p.id === id);
    if (!req) return;
    set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
    await useEvacuationPointsStore.getState().mark(req.incidentPos, req.ranger, req.at);
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
  },
}));
