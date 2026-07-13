import { create } from "zustand";

export interface MessagePin {
  id: string;
  rangerId: string;
  rangerName: string;
  callsign: string;
  text: string;
  /** Wherever the ranger actually was standing when they sent this. */
  lat: number;
  lon: number;
  timestamp: number;
}

interface MessagePinsState {
  pins: MessagePin[];
  addPin: (pin: Omit<MessagePin, "id" | "timestamp">) => void;
}

/**
 * Status messages from personel, pinned to wherever they were when they sent
 * them — like sharing a location in a chat app. Real version needs the
 * geotagged-message backend work (see TODO.md); this is populated by the
 * simulated task-assignment flow in `src/store/tasks.ts` for now.
 */
export const useMessagePinsStore = create<MessagePinsState>((set) => ({
  pins: [],
  addPin: (pin) =>
    set((s) => ({
      pins: [...s.pins, { ...pin, id: `${pin.rangerId}-${Date.now()}`, timestamp: Date.now() }],
    })),
}));
