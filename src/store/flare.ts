import { create } from "zustand";
import { flareApi } from "@/lib/api";
import { socket } from "@/lib/socket";
import { FLARE_AUTO_EXPIRY_MS } from "@/lib/timings";

interface FlareState {
  /** True once a FLARE is triggered, false again once stood down (manually, or by the 2-minute auto-expiry backstop) — no longer "never resets". */
  active: boolean;
  /** Increments on every trigger, so effects that already ran once can replay. */
  sequence: number;
  /** False right after a trigger until the operator visits the tactical map. */
  seen: boolean;
  trigger: () => Promise<void>;
  deactivate: () => Promise<void>;
  markSeen: () => void;
}

// Auto-expiry backstop: if nobody presses "Stand Down," the FLARE deactivates
// on its own after FLARE_AUTO_EXPIRY_MS (lib/timings.ts). Keyed to `sequence`
// so a stale timer from a FLARE that's already been superseded (or manually
// stood down) can't fire.
let autoExpiryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Global FLARE alert state — synced to backend via POST /flare/activate and
 * POST /flare/deactivate, kept live via the flare-broadcast Socket.IO event.
 * All clients (radar + any future personel app) see the same FLARE state.
 */
export const useFlareStore = create<FlareState>((set, get) => {
  // Real-time: another client (or the backend itself) can broadcast a FLARE
  // going active or being stood down.
  socket.on("flare-broadcast", (payload: { flareId: string; sequence: number; status: string }) => {
    if (!payload || typeof payload.sequence !== "number") return; // malformed payload, ignore rather than throw
    if (payload.status === "active") {
      set((s) => ({
        active: true,
        sequence: payload.sequence,
        seen: s.seen && s.sequence === payload.sequence, // mark unseen if it's a new sequence
      }));
    } else if (payload.status === "calm") {
      if (autoExpiryTimer) {
        clearTimeout(autoExpiryTimer);
        autoExpiryTimer = null;
      }
      set({ active: false });
    }
  });

  return {
    active: false,
    sequence: 0,
    seen: true,

    trigger: async () => {
      // Optimistic update first so the UI reacts instantly
      set((s) => ({ active: true, sequence: s.sequence + 1, seen: false }));

      // `let`, not `const` — corrected below once the backend's real
      // sequence comes back, so the auto-expiry timer (and its own stale
      // check) keeps watching the right number.
      let watchedSequence = get().sequence;
      if (autoExpiryTimer) clearTimeout(autoExpiryTimer);
      autoExpiryTimer = setTimeout(() => {
        if (get().active && get().sequence === watchedSequence) void get().deactivate();
      }, FLARE_AUTO_EXPIRY_MS);

      try {
        const created = await flareApi.activate();
        // The backend computes its own sequence from existing FlareAlert
        // rows, independent of this client's optimistic guess — they only
        // coincide on a client's very first-ever trigger. Correct the local
        // value here, synchronously on the HTTP response, so it already
        // matches by the time the flare-broadcast echo of this same
        // activation arrives. Without this, the echo's (differing) sequence
        // looks like a brand-new FLARE to FlareSequence's
        // `useEffect(..., [sequence])` and restarts the whole cinematic
        // mid-flight — this is exactly what caused a duplicated "DETEKSI"
        // log line, found via manual testing.
        if (typeof created?.sequence === "number" && created.sequence !== watchedSequence) {
          watchedSequence = created.sequence;
          set({ sequence: created.sequence });
        }
      } catch (err) {
        console.warn("[flare] Failed to persist FLARE to backend:", err);
        // Keep optimistic state — FLARE must show even if backend is unreachable
      }
    },

    deactivate: async () => {
      if (autoExpiryTimer) {
        clearTimeout(autoExpiryTimer);
        autoExpiryTimer = null;
      }
      set({ active: false });
      try {
        await flareApi.deactivate();
      } catch (err) {
        console.warn("[flare] Failed to persist stand-down to backend:", err);
        // Keep it stood down locally — an operator who pressed the button
        // expects it gone regardless of backend reachability.
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
