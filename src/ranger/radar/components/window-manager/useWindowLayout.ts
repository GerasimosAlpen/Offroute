import { create } from "zustand";

export interface WindowRect {
  /** All fields are fractions of the desktop container (0..1), not pixels — stays correct if the browser window resizes. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const STORAGE_KEY = "offroute.radar.windowLayout";

interface StoredLayout {
  rects: Record<string, WindowRect>;
  zOrder: string[];
}

function loadStored(): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rects: {}, zOrder: [] };
    const parsed = JSON.parse(raw);
    return { rects: parsed.rects ?? {}, zOrder: parsed.zOrder ?? [] };
  } catch {
    return { rects: {}, zOrder: [] };
  }
}

function persist(rects: Record<string, WindowRect>, zOrder: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rects, zOrder }));
  } catch {
    // localStorage unavailable (private mode, quota) — layout just won't persist, non-fatal
  }
}

interface WindowLayoutState {
  rects: Record<string, WindowRect>;
  zOrder: string[];
  /** Transient (never persisted) — the Windows-Snap-style preview rect shown while a drag is near an edge/corner. */
  dragSnapZone: WindowRect | null;
  setRect: (id: string, rect: WindowRect) => void;
  focus: (id: string) => void;
  zIndexOf: (id: string) => number;
  setDragSnapZone: (zone: WindowRect | null) => void;
  resetLayout: () => void;
}

/**
 * Persisted drag/resize/snap state for radar's floating-window desktop
 * (Tactical Map's panels) — a real windowing preference, not throwaway UI
 * state, so it's kept in localStorage the same way `getSelfRanger` persists
 * personel's identity: small, synchronous, no need for the SQLite cache.
 */
export const useWindowLayout = create<WindowLayoutState>((set, get) => {
  const stored = loadStored();

  return {
    rects: stored.rects,
    zOrder: stored.zOrder,
    dragSnapZone: null,

    setDragSnapZone: (zone) => set({ dragSnapZone: zone }),

    setRect: (id, rect) => {
      set((s) => {
        const rects = { ...s.rects, [id]: rect };
        persist(rects, s.zOrder);
        return { rects };
      });
    },

    focus: (id) => {
      set((s) => {
        const zOrder = [...s.zOrder.filter((w) => w !== id), id];
        persist(s.rects, zOrder);
        return { zOrder };
      });
    },

    zIndexOf: (id) => {
      const idx = get().zOrder.indexOf(id);
      return idx === -1 ? 0 : idx + 1;
    },

    resetLayout: () => {
      persist({}, []);
      set({ rects: {}, zOrder: [] });
    },
  };
});
