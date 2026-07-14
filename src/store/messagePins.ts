import { create } from "zustand";
import { messagesApi, type CreateMessagePinDto } from "@/lib/api";
import { socket } from "@/lib/socket";
import { cacheGetAll, cacheSet } from "@/lib/offlineCache";

export interface MessagePin {
  id: string;
  rangerId: string;
  rangerName: string;
  callsign: string;
  text: string;
  lat: number;
  lon: number;
  timestamp: number;
}

interface MessagePinsState {
  pins: MessagePin[];
  loaded: boolean;
  addPin: (pin: Omit<MessagePin, "id" | "timestamp">) => Promise<void>;
  loadPins: () => Promise<void>;
}

function apiPinToLocal(p: Record<string, unknown>): MessagePin {
  return {
    id: p.id as string,
    rangerId: p.rangerId as string,
    rangerName: p.rangerName as string,
    callsign: p.callsign as string,
    text: p.text as string,
    lat: p.lat as number,
    lon: p.lon as number,
    timestamp: new Date(p.createdAt as string).getTime(),
  };
}

/**
 * Geotagged status messages from personel.
 * Persisted to backend (POST /messages/pin) and live via message-pin WS event.
 */
export const useMessagePinsStore = create<MessagePinsState>((set, get) => {
  // Real-time: any client posting a pin broadcasts it to all others
  socket.on("message-pin", (pin: Record<string, unknown>) => {
    if (!pin || typeof pin.id !== "string") return; // malformed payload, ignore rather than throw
    const local = apiPinToLocal(pin);
    const exists = get().pins.some((p) => p.id === local.id);
    if (!exists) set((s) => ({ pins: [...s.pins, local] }));
  });

  return {
    pins: [],
    loaded: false,

    loadPins: async () => {
      if (get().loaded) return;
      try {
        const remote = await messagesApi.pins();
        const pins = remote.map(apiPinToLocal);
        set({ pins, loaded: true });
        void cacheSet("messagePins", pins);
      } catch (err) {
        console.warn("[messagePins] Failed to load from API:", err);
        const cached = await cacheGetAll<MessagePin>("messagePins");
        set({ pins: cached, loaded: true });
      }
    },

    addPin: async (pin) => {
      // Optimistic local add
      const localId = `${pin.rangerId}-${Date.now()}`;
      const localPin: MessagePin = { ...pin, id: localId, timestamp: Date.now() };
      set((s) => ({ pins: [...s.pins, localPin] }));

      try {
        const dto: CreateMessagePinDto = {
          rangerId: pin.rangerId,
          rangerName: pin.rangerName,
          callsign: pin.callsign,
          text: pin.text,
          lat: pin.lat,
          lon: pin.lon,
        };
        const saved = await messagesApi.addPin(dto);
        // Replace the optimistic pin with the server-persisted version
        set((s) => ({
          pins: s.pins.map((p) => (p.id === localId ? apiPinToLocal(saved) : p)),
        }));
      } catch (err) {
        console.warn("[messagePins] Failed to persist pin to backend:", err);
        // Keep the optimistic pin — it's still visible locally
      }
    },
  };
});
