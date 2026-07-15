import { create } from "zustand";
import { socket } from "@/lib/socket";
import { RANGERS } from "@/lib/rangers";

/**
 * Radar's single pane of glass — every action from every role, on one live
 * timeline. This store is a read-only *observer*: it subscribes to all the
 * domain WS events the backend broadcasts and turns them into one
 * chronological feed, so the operator can watch the whole operation
 * (warga reports, SOS pings, unit dispatches/completions, evacuations,
 * FLARE, backup calls, units coming online) happening simultaneously,
 * without hunting across panels. It never writes anything back.
 */
export type ActivityDomain =
  | "incident"
  | "sos"
  | "unit"
  | "evac"
  | "flare"
  | "backup"
  | "presence";

export interface ActivityItem {
  id: number;
  ts: number;
  domain: ActivityDomain;
  /** Who/what the line is about, short. */
  actor: string;
  /** What happened. */
  text: string;
  /** Severity accent. */
  tone: "info" | "good" | "warn" | "alert";
}

interface SystemActivityState {
  items: ActivityItem[];
}

const MAX_ITEMS = 120;
let seq = 0;

export const useSystemActivity = create<SystemActivityState>(() => ({ items: [] }));

function push(domain: ActivityDomain, actor: string, text: string, tone: ActivityItem["tone"]) {
  const item: ActivityItem = { id: ++seq, ts: Date.now(), domain, actor, text, tone };
  useSystemActivity.setState((s) => ({ items: [...s.items.slice(-(MAX_ITEMS - 1)), item] }));
}

function nameOf(rangerId: string, fallbackName?: string, callsign?: string) {
  const known = RANGERS.find((r) => r.id === rangerId);
  const name = fallbackName ?? known?.name ?? rangerId;
  const cs = callsign ?? known?.callsign;
  return cs ? `${name} (${cs})` : name;
}

// Only wire the observers once, at module load — like the domain stores.
let wired = false;

/** Called from radar's activity panel; starts the observers on first use. */
export function startSystemActivity() {
  if (wired) return;
  wired = true;

  socket.on("incident-new", (i: any) => {
    if (!i) return;
    push("incident", "WARGA/LAPOR", `insiden baru: ${i.label ?? "tanpa label"} (${i.severity ?? "?"})`, i.severity === "critical" ? "alert" : "warn");
  });

  socket.on("victim-sos", (v: any) => {
    if (!v?.id) return;
    // A late field-report update also arrives as victim-sos; only announce the
    // fresh-ping shape (no reporter yet) as a new SOS.
    if (v.reportedRangerId) {
      push("sos", "SOS", `${v.label || "korban"} dilaporkan ditemukan — perlu konfirmasi`, "warn");
    } else {
      push("sos", "SOS", `${v.label || "sinyal anonim"} mengirim lokasi`, "alert");
    }
  });
  socket.on("victim-rescued", (p: any) => {
    if (!p?.id) return;
    push("sos", "SOS", `korban ${String(p.id).slice(0, 6)} dikonfirmasi selamat`, "good");
  });

  socket.on("task-update", (t: any) => {
    if (!t?.rangerId) return;
    const who = nameOf(t.rangerId, t.rangerName, t.callsign);
    if (t.status === "arrived") {
      push("unit", who, "lapor tugas selesai — menunggu konfirmasi HQ", "warn");
    } else if (t.selfAssigned) {
      push("unit", who, "mengambil tugas secara mandiri", "info");
    } else {
      push("unit", who, "dikirim ke lokasi", "info");
    }
  });
  socket.on("task-confirmed", (t: any) => {
    if (!t?.rangerId) return;
    push("unit", nameOf(t.rangerId, t.rangerName, t.callsign), "tugas selesai & dikonfirmasi", "good");
  });
  socket.on("task-rejected", (t: any) => {
    if (!t?.rangerId) return;
    push("unit", nameOf(t.rangerId, t.rangerName, t.callsign), "laporan dikembalikan — lanjut bertugas", "warn");
  });

  socket.on("evac-request", (r: any) => {
    if (!r?.rangerId) return;
    push("evac", nameOf(r.rangerId, r.rangerName, r.callsign), "mengajukan titik evakuasi aman", "info");
  });
  socket.on("evac-confirmed", () => push("evac", "PUSAT", "titik evakuasi dikonfirmasi", "good"));
  socket.on("evac-request-decided", (p: any) => {
    if (!p) return;
    push("evac", "PUSAT", p.accepted ? "permintaan evakuasi diterima" : "permintaan evakuasi ditolak", p.accepted ? "good" : "warn");
  });
  socket.on("evac-removed", () => push("evac", "PUSAT", "titik evakuasi dihapus", "warn"));

  socket.on("flare-broadcast", (f: any) => {
    if (!f) return;
    if (f.status === "active") push("flare", "SISTEM", `DARURAT BESAR #${f.sequence} AKTIF`, "alert");
    else push("flare", "SISTEM", "status kembali aman", "good");
  });

  socket.on("message-pin", (p: any) => {
    if (!p?.rangerId) return;
    const isBackup = typeof p.text === "string" && p.text.toUpperCase().includes("MINTA BACKUP");
    push(isBackup ? "backup" : "unit", nameOf(p.rangerId, p.rangerName, p.callsign), isBackup ? "MINTA BACKUP di lokasinya" : `pesan: ${p.text}`, isBackup ? "alert" : "info");
  });

  // Presence join/leave — diff snapshots so we get "unit online/offline",
  // not a line every heartbeat.
  let known = new Set<string>();
  socket.on("presence-update", (entries: any[]) => {
    if (!Array.isArray(entries)) return;
    const now = new Set<string>(entries.map((e) => e?.rangerId).filter(Boolean));
    for (const id of now) if (!known.has(id)) push("presence", nameOf(id), "unit daring", "good");
    for (const id of known) if (!now.has(id)) push("presence", nameOf(id), "unit terputus", "warn");
    known = now;
  });
}
