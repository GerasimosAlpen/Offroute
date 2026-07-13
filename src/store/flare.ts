import { create } from "zustand";

interface FlareState {
  /** True from the first FLARE trigger onward — never resets, since the point is that we now know where everyone is. */
  active: boolean;
  /** Increments on every trigger, so effects that already ran once can replay (re-key off this). */
  sequence: number;
  /** False right after a trigger until the operator actually visits the tactical map — drives the cross-page notification. */
  seen: boolean;
  trigger: () => void;
  markSeen: () => void;
}

/**
 * Global "declare major incident" signal — the radar role's FLARE action
 * from the README spec. Any page can trigger it (sidebar button), any page
 * can react to it (currently just the tactical map). Simulated for now: no
 * real detection system or Bluetooth mesh exists yet, see TODO.md.
 */
export const useFlareStore = create<FlareState>((set) => ({
  active: false,
  sequence: 0,
  seen: true,
  trigger: () => set((s) => ({ active: true, sequence: s.sequence + 1, seen: false })),
  markSeen: () => set({ seen: true }),
}));
