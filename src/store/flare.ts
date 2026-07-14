import { create } from "zustand";
import { flareApi } from "@/lib/api";
import { socket } from "@/lib/socket";

interface FlareState {
  /** True from the first FLARE trigger onward — never resets. */
  active: boolean;
  /** Increments on every trigger, so effects that already ran once can replay. */
  sequence: number;
  /** False right after a trigger until the operator visits the tactical map. */
  seen: boolean;
  trigger: () => Promise<void>;
  markSeen: () => void;
}

/**
 * Global FLARE alert state — synced to backend via POST /flare/activate
 * and kept live via the flare-broadcast Socket.IO event.
 * All clients (radar + any future personel app) see the same FLARE state.
 */
export const useFlareStore = create<FlareState>((set) => {
  // Real-time: another client (or the backend itself) can broadcast a FLARE
  socket.on("flare-broadcast", (payload: { flareId: string; sequence: number; status: string }) => {
    if (payload.status === "active") {
      set((s) => ({
        active: true,
        sequence: payload.sequence,
        seen: s.seen && s.sequence === payload.sequence, // mark unseen if it's a new sequence
      }));
    }
  });

  return {
    active: false,
    sequence: 0,
    seen: true,

    trigger: async () => {
      // Optimistic update first so the UI reacts instantly
      set((s) => ({ active: true, sequence: s.sequence + 1, seen: false }));
      try {
        await flareApi.activate();
      } catch (err) {
        console.warn("[flare] Failed to persist FLARE to backend:", err);
        // Keep optimistic state — FLARE must show even if backend is unreachable
      }
    },

    markSeen: () => set({ seen: true }),
  };
});

/** Load most recent FLARE from backend on app start (resume state after reload). */
export async function loadFlareState() {
  try {
    const latest = await flareApi.current();
    if (latest?.status === "active") {
      useFlareStore.setState((s) => ({
        active: true,
        sequence: Math.max(s.sequence, latest.sequence),
        seen: true, // already seen (it's a reload)
      }));
    }
  } catch {
    // Ignore — offline-first, local state is enough
  }
}
