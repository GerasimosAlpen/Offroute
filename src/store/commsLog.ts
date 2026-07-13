import { create } from "zustand";

export interface CommEntry {
  time: string;
  sender: string;
  color: string;
  lead: string;
  body: string;
}

interface CommsLogState {
  entries: CommEntry[];
  append: (entry: Omit<CommEntry, "time">) => void;
}

function formatNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const INITIAL_LOG: CommEntry[] = [
  {
    time: "08:45:12",
    sender: "PUSAT",
    color: "#66df75",
    lead: "PEMBARUAN",
    body: "data satelit selesai.",
  },
  {
    time: "08:44:05",
    sender: "TIM BRAVO",
    color: "#e5e2e1",
    lead: "POSISI DI",
    body: "Koor 06°13'S. Menunggu instruksi.",
  },
  {
    time: "08:40:22",
    sender: "SISTEM",
    color: "#ff0040",
    lead: "DETEKSI",
    body: "anomali suhu di Sektor Utara.",
  },
  {
    time: "08:35:10",
    sender: "TIM ALPHA",
    color: "#e5e2e1",
    lead: "SELESAI",
    body: "menyisir area perumahan. Negatif korban.",
  },
];

/**
 * Global comms log — shared so the FLARE sequence (tactical map) can post
 * dispatch/status updates that show up in the Comm Center panel, same as a
 * real radio log would, instead of each component keeping its own copy.
 */
export const useCommsLogStore = create<CommsLogState>((set) => ({
  entries: INITIAL_LOG,
  append: (entry) =>
    set((s) => ({ entries: [...s.entries, { ...entry, time: formatNow() }] })),
}));
