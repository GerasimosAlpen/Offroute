import { useEffect, useRef, useState } from "preact/hooks";
import {
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  Server,
  Radio,
  Bluetooth,
  MapPin,
  UploadCloud,
  Waves,
  Users,
  Wrench,
  PlugZap,
} from "lucide-preact";
import { Link } from "wouter";
import { TerminalSquare, Trash2, Power, FileDown, Database as DbIcon } from "lucide-preact";
import { RadarPageShell } from "../components/RadarPageShell";
import { SystemActivityFeed } from "../components/SystemActivityFeed";
import { isTauri } from "@/lib/tauri";
import { socket } from "@/lib/socket";
import { getApiBaseUrl } from "@/lib/apiBase";
import { healthApi, adminApi, type HealthResult, type DbStats } from "@/lib/api";
import { runTerminalCommand } from "@/lib/terminal";
import { getQueuedMutations, retryQueuedMutations } from "@/lib/offlineCache";
import { queryClient } from "@/lib/queryClient";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useBluetoothStore } from "@/store/bluetooth";
import { useDeviceLocation } from "@/store/location";
import { useBmkgQuake } from "@/store/bmkg";
import { usePresenceStore } from "@/store/presence";

const HEALTH_POLL_MS = 5000;

type Tone = "good" | "warn" | "bad" | "idle";
const TONE: Record<Tone, string> = {
  good: "#66df75",
  warn: "#fabd00",
  bad: "#ff0040",
  idle: "#666",
};

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
}) {
  const color = TONE[tone];
  return (
    <div className="bg-[#1a1a1a] border border-[#333] border-l-2 p-3 flex flex-col gap-1" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-1.5 font-mono text-[9px] text-[#888] uppercase tracking-widest">
        <Icon size={11} style={{ color }} /> {label}
      </div>
      <div className="font-grotesk font-bold text-lg leading-tight" style={{ color }}>
        {value}
      </div>
      {sub && <div className="font-mono text-[10px] text-[#666] truncate">{sub}</div>}
    </div>
  );
}

export function SystemMonitor() {
  const online = useOnlineStatus();
  const bt = useBluetoothStore();
  const { status: gpsStatus, coords } = useDeviceLocation();
  const { status: bmkgStatus } = useBmkgQuake();
  const presenceCount = usePresenceStore((s) => Object.keys(s.units).length);

  const [health, setHealth] = useState<HealthResult | null>(null);
  const [wsConnected, setWsConnected] = useState(socket.connected);
  const [queueDepth, setQueueDepth] = useState(0);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [log, setLog] = useState<{ id: number; text: string; tone: Tone }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const logSeq = useRef(0);

  const note = (text: string, tone: Tone = "good") =>
    setLog((l) => [{ id: ++logSeq.current, text, tone }, ...l].slice(0, 8));

  const refreshHealth = async () => {
    setHealth(await healthApi.ping());
    setQueueDepth((await getQueuedMutations()).length);
    try {
      setStats(await adminApi.stats());
    } catch {
      setStats(null);
    }
  };

  useEffect(() => {
    void refreshHealth();
    const t = setInterval(refreshHealth, HEALTH_POLL_MS);
    const onConn = () => setWsConnected(true);
    const onDisc = () => setWsConnected(false);
    socket.on("connect", onConn);
    socket.on("disconnect", onDisc);
    return () => {
      clearInterval(t);
      socket.off("connect", onConn);
      socket.off("disconnect", onDisc);
    };
  }, []);

  // ─── Self-heal commands ─────────────────────────────────────────────────
  const runReconnect = () => {
    setBusy("reconnect");
    socket.disconnect();
    socket.connect();
    note("Menyambungkan ulang WebSocket...", "warn");
    setTimeout(() => {
      setWsConnected(socket.connected);
      note(socket.connected ? "WebSocket tersambung kembali." : "WebSocket masih terputus — coba lagi.", socket.connected ? "good" : "bad");
      setBusy(null);
    }, 1500);
  };

  const runRetryQueue = async () => {
    setBusy("queue");
    const before = (await getQueuedMutations()).length;
    await retryQueuedMutations();
    const after = (await getQueuedMutations()).length;
    setQueueDepth(after);
    note(`Antrean offline: ${before} → ${after} (${before - after} terkirim).`, after === 0 ? "good" : "warn");
    setBusy(null);
  };

  const runRescanBle = async () => {
    setBusy("ble");
    try {
      await bt.startScan();
      note("Pemindaian Bluetooth dimulai ulang.", "good");
    } catch {
      note("Gagal memulai pemindaian Bluetooth (adapter tidak tersedia?).", "bad");
    }
    setBusy(null);
  };

  const runRefreshData = async () => {
    setBusy("data");
    await queryClient.invalidateQueries();
    note("Semua data ditarik ulang dari server.", "good");
    setBusy(null);
  };

  const runHealthCheck = async () => {
    setBusy("health");
    await refreshHealth();
    note("Pemeriksaan sistem selesai.", "good");
    setBusy(null);
  };

  // ─── System control (destructive / app-level) ───────────────────────────
  const runReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      note("Klik sekali lagi untuk mengonfirmasi reset data (menghapus semua).", "warn");
      setTimeout(() => setConfirmReset(false), 5000);
      return;
    }
    setConfirmReset(false);
    setBusy("reset");
    note("Mereset database ke kondisi awal...", "warn");
    try {
      const r = await adminApi.reseed();
      note(`Data direset — personel ${r.personnel}, insiden ${r.incidents}. Memuat ulang klien...`, "good");
      // The backend broadcasts data-reset; App.tsx reloads every client.
    } catch {
      note("Gagal mereset — server tidak terjangkau.", "bad");
    }
    setBusy(null);
  };

  const runReport = async () => {
    setBusy("report");
    const [line] = await runTerminalCommand("report", { onClear: () => {} });
    note(line?.text ?? "Laporan dibuat.", line?.kind === "error" ? "bad" : "good");
    setBusy(null);
  };

  const runRestart = async () => {
    if (!isTauri) {
      note("Mulai-ulang aplikasi butuh desktop (Tauri). Muat ulang halaman di browser.", "warn");
      return;
    }
    note("Memulai ulang aplikasi...", "warn");
    await runTerminalCommand("restart", { onClear: () => {} });
  };

  const connectedBt = bt.devices.filter((d) => d.connected).length;
  const apiTone: Tone = health == null ? "idle" : !health.ok ? "bad" : health.latencyMs > 1500 ? "warn" : "good";

  return (
    <RadarPageShell
      title="Monitor Sistem"
      description="Kesehatan API, koneksi, mesh Bluetooth, sensor — dan perbaikan mandiri."
    >
      <div className="flex flex-col gap-6 max-w-6xl">
        {/* ── Parameters ─────────────────────────────────────────── */}
        <section>
          <h3 className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Activity size={12} /> Parameter Sistem
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            <StatTile
              icon={Server}
              label="API Backend"
              value={health == null ? "..." : health.ok ? "TERSAMBUNG" : "TERPUTUS"}
              sub={health == null ? "" : `${health.latencyMs} ms`}
              tone={apiTone}
            />
            <StatTile
              icon={Database}
              label="Database"
              value={health == null ? "..." : health.db ? "OK" : health.ok ? "TIDAK OK" : "?"}
              sub={health?.ok && !health.db ? "API hidup, DB mati" : ""}
              tone={health == null ? "idle" : health.db ? "good" : "bad"}
            />
            <StatTile
              icon={wsConnected ? Radio : PlugZap}
              label="WebSocket"
              value={wsConnected ? "LIVE" : "TERPUTUS"}
              sub={wsConnected ? (socket.id ?? "") : "realtime nonaktif"}
              tone={wsConnected ? "good" : "bad"}
            />
            <StatTile
              icon={online ? Wifi : WifiOff}
              label="Konektivitas"
              value={online ? "ONLINE" : "OFFLINE"}
              sub={online ? "jaringan tersedia" : "mode offline aktif"}
              tone={online ? "good" : "warn"}
            />
            <StatTile
              icon={UploadCloud}
              label="Antrean Offline"
              value={String(queueDepth)}
              sub={queueDepth === 0 ? "tidak ada tertunda" : "menunggu koneksi"}
              tone={queueDepth === 0 ? "good" : "warn"}
            />
            <StatTile
              icon={Bluetooth}
              label="Mesh Bluetooth"
              value={bt.scanning ? "MEMINDAI" : connectedBt > 0 ? `${connectedBt} TERHUBUNG` : "SIAGA"}
              sub={bt.lastError ? bt.lastError : `${bt.devices.length} perangkat terlihat`}
              tone={bt.lastError ? "bad" : connectedBt > 0 || bt.scanning ? "good" : "idle"}
            />
            <StatTile
              icon={MapPin}
              label="GPS / Lokasi"
              value={gpsStatus === "ready" || gpsStatus === "cached" ? "TERKUNCI" : gpsStatus.toUpperCase()}
              sub={coords ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : "belum ada fix"}
              tone={gpsStatus === "ready" ? "good" : gpsStatus === "denied" || gpsStatus === "unavailable" ? "bad" : "warn"}
            />
            <StatTile
              icon={Waves}
              label="Feed BMKG"
              value={bmkgStatus === "ready" ? "AKTIF" : bmkgStatus.toUpperCase()}
              sub="gempa realtime"
              tone={bmkgStatus === "ready" ? "good" : bmkgStatus === "loading" ? "warn" : "bad"}
            />
            <StatTile
              icon={Users}
              label="Unit Daring"
              value={String(presenceCount)}
              sub="personel terhubung"
              tone={presenceCount > 0 ? "good" : "idle"}
            />
            <StatTile icon={Server} label="Alamat Server" value={getApiBaseUrl().replace(/^https?:\/\//, "")} tone="idle" />
          </div>
        </section>

        {/* ── Self-heal command bar ──────────────────────────────── */}
        <section>
          <h3 className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Wrench size={12} /> Perbaikan Mandiri
          </h3>
          <div className="flex flex-wrap gap-2">
            <CmdButton icon={PlugZap} label="Sambung Ulang" busy={busy === "reconnect"} onClick={runReconnect} />
            <CmdButton icon={UploadCloud} label="Kirim Antrean" busy={busy === "queue"} onClick={runRetryQueue} disabled={queueDepth === 0} />
            <CmdButton icon={Bluetooth} label="Pindai Ulang BT" busy={busy === "ble"} onClick={runRescanBle} />
            <CmdButton icon={RefreshCw} label="Tarik Data" busy={busy === "data"} onClick={runRefreshData} />
            <CmdButton icon={Activity} label="Cek Sistem" busy={busy === "health"} onClick={runHealthCheck} />
          </div>
          {log.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 font-mono text-[11px]">
              {log.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full shrink-0" style={{ background: TONE[l.tone] }} />
                  <span className="text-[#c0b0b3]">{l.text}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── System control (API / OS / data) ──────────────────── */}
        <section>
          <h3 className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Power size={12} /> Kontrol Sistem
          </h3>
          <div className="flex flex-wrap items-stretch gap-2">
            <Link
              href="/ranger/radar/terminal"
              className="flex items-center gap-2 px-3 py-2 border border-[#444] bg-[#262626] text-[#e5e2e1] font-mono text-xs uppercase tracking-wide hover:border-[#66df75] hover:text-[#66df75] transition-colors"
            >
              <TerminalSquare size={13} /> Buka Terminal
            </Link>
            <CmdButton icon={FileDown} label="Ekspor Laporan" busy={busy === "report"} onClick={runReport} />
            <button
              type="button"
              onClick={runReset}
              disabled={busy === "reset"}
              className={`flex items-center gap-2 px-3 py-2 border font-mono text-xs uppercase tracking-wide transition-colors disabled:opacity-40 ${
                confirmReset
                  ? "border-[#ff0040] bg-[#ff0040]/20 text-[#ff0040]"
                  : "border-[#fabd00] bg-[#fabd00]/10 text-[#fabd00] hover:brightness-125"
              }`}
            >
              <Trash2 size={13} /> {confirmReset ? "Yakin? Reset Data" : "Reset Data Mock"}
            </button>
            <button
              type="button"
              onClick={runRestart}
              className="flex items-center gap-2 px-3 py-2 border border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] font-mono text-xs uppercase tracking-wide hover:brightness-125 transition-colors"
            >
              <Power size={13} /> Mulai Ulang Aplikasi
            </button>
          </div>
          <p className="mt-2 font-mono text-[9px] text-[#555]">
            "Mulai Ulang" merestart aplikasi Offroute — bukan me-reboot OS (itu destruktif & butuh hak akses khusus).
          </p>

          {/* Live DB row counts — what's actually in the database right now. */}
          {stats && (
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px]">
              <span className="flex items-center gap-1 text-[#888]"><DbIcon size={11} /> DB:</span>
              {([
                ["personel", stats.personnel],
                ["insiden", stats.incidents],
                ["tugas", stats.tasks],
                ["selesai", stats.resolved],
                ["korban", stats.victims],
                ["titik-evak", stats.evacPoints],
                ["req-evak", stats.evacRequests],
                ["comms", stats.comms],
                ["pin", stats.messagePins],
                ["flare", stats.flares],
              ] as const).map(([k, v]) => (
                <span key={k} className="px-1.5 py-0.5 border border-[#333] bg-[#1a1a1a] text-[#c0b0b3]">
                  {k} <span className="text-[#66df75]">{v}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Live activity — every action from every role ───────── */}
        <section className="flex flex-col min-h-0">
          <h3 className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Radio size={12} /> Aktivitas Langsung — Semua Peran
          </h3>
          <div className="h-[340px] border border-[#333]">
            <SystemActivityFeed />
          </div>
        </section>
      </div>
    </RadarPageShell>
  );
}

function CmdButton({
  icon: Icon,
  label,
  onClick,
  busy,
  disabled,
}: {
  icon: typeof Activity;
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="flex items-center gap-2 px-3 py-2 border border-[#444] bg-[#262626] text-[#e5e2e1] font-mono text-xs uppercase tracking-wide hover:border-[#5fb3b3] hover:text-[#5fb3b3] disabled:opacity-40 disabled:hover:border-[#444] disabled:hover:text-[#e5e2e1] transition-colors"
    >
      <Icon size={13} className={busy ? "animate-spin" : ""} /> {label}
    </button>
  );
}
