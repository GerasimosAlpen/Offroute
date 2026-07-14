import { create } from "zustand";
import { victimsApi, type Victim, type RangerRefDto } from "@/lib/api";
import { socket } from "@/lib/socket";
import { cacheGetAll, cacheSet } from "@/lib/offlineCache";
import { raiseAlert } from "@/lib/alerts";

interface VictimsState {
  active: Victim[];
  loaded: boolean;
  loadActive: () => Promise<void>;
  assignRanger: (id: string, ranger: RangerRefDto) => Promise<void>;
  reportFound: (id: string, ranger: RangerRefDto) => Promise<void>;
  rejectReport: (id: string) => Promise<void>;
  confirmRescue: (id: string) => Promise<void>;
}

/**
 * Rescue is a two-step confirmation, not a radar-unilateral toggle — a
 * personel unit reports the victim found/secured (`reportFound`), and only
 * radar accepting that report (`confirmRescue`) actually clears them.
 * Mirrors the existing evacuation-request accept/reject shape.
 */
export const useVictimsStore = create<VictimsState>((set, get) => {
  socket.on("victim-sos", (victim: Victim) => {
    if (!victim || typeof victim.id !== "string") return; // malformed payload, ignore rather than throw
    set((s) => {
      const prior = s.active.find((v) => v.id === victim.id);
      if (!prior) {
        raiseAlert("Sinyal SOS baru", victim.label ? `${victim.label} mengirim lokasi.` : "Seseorang mengirim sinyal SOS.");
      } else if (!prior.reportedRangerId && victim.reportedRangerId) {
        raiseAlert("Laporan korban ditemukan", `${victim.reportedRangerName} (${victim.reportedCallsign}) melaporkan korban aman — perlu konfirmasi.`);
      }
      const active = s.active.filter((v) => v.id !== victim.id);
      return { active: victim.status === "active" ? [...active, victim] : active };
    });
  });

  socket.on("victim-rescued", (payload: { id?: string }) => {
    if (!payload || typeof payload.id !== "string") return;
    set((s) => ({ active: s.active.filter((v) => v.id !== payload.id) }));
  });

  return {
    active: [],
    loaded: false,

    loadActive: async () => {
      if (get().loaded) return;
      try {
        const active = await victimsApi.active();
        set({ active, loaded: true });
        void cacheSet("victims", active);
      } catch (err) {
        console.warn("[victims] Failed to load active victims from API:", err);
        const cached = await cacheGetAll<Victim>("victims");
        set({ active: cached, loaded: true });
      }
    },

    assignRanger: async (id, ranger) => {
      set((s) => ({
        active: s.active.map((v) =>
          v.id === id
            ? { ...v, assignedRangerId: ranger.rangerId, assignedRangerName: ranger.rangerName, assignedCallsign: ranger.callsign }
            : v,
        ),
      }));
      try {
        await victimsApi.assign(id, ranger);
      } catch (err) {
        console.warn("[victims] Failed to persist unit assignment:", err);
      }
    },

    reportFound: async (id, ranger) => {
      set((s) => ({
        active: s.active.map((v) =>
          v.id === id
            ? { ...v, reportedRangerId: ranger.rangerId, reportedRangerName: ranger.rangerName, reportedCallsign: ranger.callsign }
            : v,
        ),
      }));
      try {
        await victimsApi.report(id, ranger);
      } catch (err) {
        console.warn("[victims] Failed to persist found report:", err);
      }
    },

    rejectReport: async (id) => {
      set((s) => ({
        active: s.active.map((v) =>
          v.id === id ? { ...v, reportedRangerId: null, reportedRangerName: null, reportedCallsign: null } : v,
        ),
      }));
      try {
        await victimsApi.rejectReport(id);
      } catch (err) {
        console.warn("[victims] Failed to persist report rejection:", err);
      }
    },

    confirmRescue: async (id) => {
      set((s) => ({ active: s.active.filter((v) => v.id !== id) }));
      try {
        await victimsApi.confirm(id);
      } catch (err) {
        console.warn("[victims] Failed to persist rescue confirmation:", err);
      }
    },
  };
});
