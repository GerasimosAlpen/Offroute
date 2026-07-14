import { create } from "zustand";
import { commsApi } from "@/lib/api";
import { socket } from "@/lib/socket";

export interface CommEntry {
  time: string;
  sender: string;
  color: string;
  lead: string;
  body: string;
}

interface CommsLogState {
  entries: CommEntry[];
  loaded: boolean;
  append: (entry: Omit<CommEntry, "time">) => void;
  loadHistory: () => Promise<void>;
}

function formatNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Global comms log — loads history from API on first call, then stays live
 * via the comms-message Socket.IO event.
 */
export const useCommsLogStore = create<CommsLogState>((set, get) => {
  // Subscribe to real-time comms events from backend
  socket.on("comms-message", (entry: CommEntry) => {
    if (!entry || typeof entry.body !== "string") return; // malformed payload, ignore rather than throw
    // De-dupe: don't re-add entries that came back as echoes of our own POST
    const exists = get().entries.some(
      (e) => e.time === entry.time && e.sender === entry.sender && e.body === entry.body,
    );
    if (!exists) set((s) => ({ entries: [...s.entries, entry] }));
  });

  return {
    entries: [],
    loaded: false,

    loadHistory: async () => {
      if (get().loaded) return;
      try {
        const history: CommEntry[] = await commsApi.history();
        set({ entries: history, loaded: true });
      } catch (err) {
        console.warn("[commsLog] Failed to load history from API:", err);
        // Fallback to static initial log so UI isn't empty
        set({
          loaded: true,
          entries: [
            { time: "08:45:12", sender: "PUSAT",     color: "#66df75", lead: "PEMBARUAN", body: "data satelit selesai." },
            { time: "08:44:05", sender: "TIM BRAVO", color: "#e5e2e1", lead: "POSISI DI", body: "Koor 06°13'S. Menunggu instruksi." },
            { time: "08:40:22", sender: "SISTEM",    color: "#ff0040", lead: "DETEKSI",   body: "anomali suhu di Sektor Utara." },
            { time: "08:35:10", sender: "TIM ALPHA", color: "#e5e2e1", lead: "SELESAI",   body: "menyisir area perumahan. Negatif korban." },
          ],
        });
      }
    },

    append: (entry) =>
      set((s) => ({ entries: [...s.entries, { ...entry, time: formatNow() }] })),
  };
});
