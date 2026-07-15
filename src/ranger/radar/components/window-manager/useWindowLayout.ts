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
  minimized: Record<string, boolean>;
  maximized: Record<string, boolean>;
}

function loadStored(): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rects: {}, zOrder: [], minimized: {}, maximized: {} };
    const parsed = JSON.parse(raw);
    return {
      rects: parsed.rects ?? {},
      zOrder: parsed.zOrder ?? [],
      minimized: parsed.minimized ?? {},
      maximized: parsed.maximized ?? {},
    };
  } catch {
    return { rects: {}, zOrder: [], minimized: {}, maximized: {} };
  }
}

function persist(
  rects: Record<string, WindowRect>,
  zOrder: string[],
  minimized: Record<string, boolean>,
  maximized: Record<string, boolean>,
) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rects, zOrder, minimized, maximized }));
  } catch {
    // localStorage unavailable (private mode, quota) — layout just won't persist, non-fatal
  }
}

interface WindowLayoutState {
  rects: Record<string, WindowRect>;
  zOrder: string[];
  /** Which windows are minimized to the taskbar — declutters the crowded radar desktop, OS-style. */
  minimized: Record<string, boolean>;
  /** Which windows are maximized (fill the desktop). Restore returns to their stored rect. */
  maximized: Record<string, boolean>;
  /** Transient (never persisted) — the Windows-Snap-style preview rect shown while a drag is near an edge/corner. */
  dragSnapZone: WindowRect | null;
  setRect: (id: string, rect: WindowRect) => void;
  focus: (id: string) => void;
  zIndexOf: (id: string) => number;
  isTop: (id: string) => boolean;
  setDragSnapZone: (zone: WindowRect | null) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  unmaximize: (id: string) => void;
  cascade: (ids: string[]) => void;
  tile: (ids: string[]) => void;
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
    minimized: stored.minimized,
    maximized: stored.maximized,
    dragSnapZone: null,

    setDragSnapZone: (zone) => set({ dragSnapZone: zone }),

    setRect: (id, rect) => {
      set((s) => {
        const rects = { ...s.rects, [id]: rect };
        persist(rects, s.zOrder, s.minimized, s.maximized);
        return { rects };
      });
    },

    focus: (id) => {
      set((s) => {
        const zOrder = [...s.zOrder.filter((w) => w !== id), id];
        persist(s.rects, zOrder, s.minimized, s.maximized);
        return { zOrder };
      });
    },

    zIndexOf: (id) => {
      const idx = get().zOrder.indexOf(id);
      return idx === -1 ? 0 : idx + 1;
    },

    /** Whether this window is the frontmost (focused) among non-minimized windows. */
    isTop: (id) => {
      const { zOrder, minimized } = get();
      const top = [...zOrder].reverse().find((w) => !minimized[w]);
      return top === id;
    },

    minimize: (id) => {
      set((s) => {
        const minimized = { ...s.minimized, [id]: true };
        persist(s.rects, s.zOrder, minimized, s.maximized);
        return { minimized };
      });
    },

    restore: (id) => {
      set((s) => {
        const minimized = { ...s.minimized, [id]: false };
        const zOrder = [...s.zOrder.filter((w) => w !== id), id]; // restoring focuses
        persist(s.rects, zOrder, minimized, s.maximized);
        return { minimized, zOrder };
      });
    },

    toggleMinimize: (id) => {
      if (get().minimized[id]) get().restore(id);
      else get().minimize(id);
    },

    toggleMaximize: (id) => {
      set((s) => {
        const maximized = { ...s.maximized, [id]: !s.maximized[id] };
        const zOrder = [...s.zOrder.filter((w) => w !== id), id]; // maximizing focuses
        persist(s.rects, zOrder, s.minimized, maximized);
        return { maximized, zOrder };
      });
    },

    unmaximize: (id) => {
      if (!get().maximized[id]) return;
      set((s) => {
        const maximized = { ...s.maximized, [id]: false };
        persist(s.rects, s.zOrder, s.minimized, maximized);
        return { maximized };
      });
    },

    // Classic OS "cascade" — stagger every window from the top-left at a
    // uniform size, all un-minimized/un-maximized.
    cascade: (ids) => {
      set((s) => {
        const rects = { ...s.rects };
        const step = 0.04;
        ids.forEach((id, i) => {
          rects[id] = { x: Math.min(0.5, i * step), y: Math.min(0.5, i * step), w: 0.5, h: 0.6 };
        });
        const maximized = { ...s.maximized };
        const minimized = { ...s.minimized };
        for (const id of ids) { maximized[id] = false; minimized[id] = false; }
        persist(rects, s.zOrder, minimized, maximized);
        return { rects, maximized, minimized };
      });
    },

    // "Tile" — pack every window into an even grid with no overlap.
    tile: (ids) => {
      set((s) => {
        const n = ids.length || 1;
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const rects = { ...s.rects };
        ids.forEach((id, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          rects[id] = { x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows };
        });
        const maximized = { ...s.maximized };
        const minimized = { ...s.minimized };
        for (const id of ids) { maximized[id] = false; minimized[id] = false; }
        persist(rects, s.zOrder, minimized, maximized);
        return { rects, maximized, minimized };
      });
    },

    resetLayout: () => {
      persist({}, [], {}, {});
      set({ rects: {}, zOrder: [], minimized: {}, maximized: {} });
    },
  };
});
