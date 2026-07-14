import { create } from "zustand";
import { commsApi, type CreateCommsEntryDto } from "@/lib/api";
import { socket } from "@/lib/socket";
import { cacheGetAll, cacheSet, enqueueMutation, registerReplayHandler } from "@/lib/offlineCache";

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

// Entries this client just appended optimistically, waiting to be matched
// against their own echo off the socket — sender+lead+body rather than an
// exact time-string match, since the backend computes its own `time`
// server-side (ignoring whatever the client sent), so a client's optimistic
// timestamp and the broadcast echo's timestamp won't line up exactly.
const pendingOwnAppends: { sender: string; lead: string; body: string }[] = [];

registerReplayHandler("commsApi.append", async (payload) => {
  await commsApi.append(payload as CreateCommsEntryDto);
});

/**
 * Global comms log — loads history from API on first call, then stays live
 * via the comms-message Socket.IO event.
 */
export const useCommsLogStore = create<CommsLogState>((set, get) => {
  // Subscribe to real-time comms events from backend
  socket.on("comms-message", (entry: CommEntry) => {
    if (!entry || typeof entry.body !== "string") return; // malformed payload, ignore rather than throw
    // De-dupe: don't re-add entries that came back as echoes of our own POST
    const pendingIdx = pendingOwnAppends.findIndex(
      (p) => p.sender === entry.sender && p.lead === entry.lead && p.body === entry.body,
    );
    if (pendingIdx !== -1) {
      pendingOwnAppends.splice(pendingIdx, 1);
      return; // already shown optimistically
    }
    set((s) => ({ entries: [...s.entries, entry] }));
  });

  return {
    entries: [],
    loaded: false,

    loadHistory: async () => {
      if (get().loaded) return;
      try {
        const history: CommEntry[] = await commsApi.history();
        set({ entries: history, loaded: true });
        // CommEntry has no `id` field of its own — synthesize one from
        // time+index just for the cache key, harmless extra property on read.
        void cacheSet("commsLog", history.map((e, i) => ({ id: `${e.time}-${i}`, ...e })));
      } catch (err) {
        console.warn("[commsLog] Failed to load history from API:", err);
        const cached = await cacheGetAll<CommEntry>("commsLog");
        if (cached.length > 0) {
          set({ entries: cached, loaded: true });
          return;
        }
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

    append: (entry) => {
      const withTime = { ...entry, time: formatNow() };
      set((s) => ({ entries: [...s.entries, withTime] }));
      pendingOwnAppends.push({ sender: entry.sender, lead: entry.lead, body: entry.body });
      // The backend computes its own `time` server-side and its DTO has no
      // `time` field — `forbidNonWhitelisted` rejects the request with 400 if
      // it's included, so send only the fields the DTO actually declares.
      commsApi.append(entry).catch((err) => {
        console.warn("[commsLog] Failed to persist entry to backend:", err);
        void enqueueMutation({ domain: "commsLog", method: "commsApi.append", payload: entry });
      });
    },
  };
});
