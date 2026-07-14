import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Radio, WifiOff, PhoneCall, Siren } from "lucide-preact";
import { useCommsLogStore } from "@/store/commsLog";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useDeviceLocation } from "@/store/location";
import { getSelfRanger } from "@/lib/rangers";
import { ChatBubble } from "@/ranger/comms/ChatBubble";
import { BluetoothStatusBar } from "@/ranger/comms/BluetoothStatusBar";

const SELF_COLOR = "#ffb2bd";
const ALL_CONTACTS = "SEMUA";
/** Indonesia's unified national emergency number — a real tel: target, not a placeholder. */
const EMERGENCY_TEL = "112";

/**
 * Same live comms channel radar's Comm Center reads/writes — a personel unit
 * and the radar operator are on one shared wire, not disconnected mocks, so
 * nobody "goes dark" just because they're on a different screen. When the
 * network drops, `commsLog.ts` already queues sends via the offline cache
 * (`mutation_queue`) and replays them on reconnect — this page just needs to
 * make that state visible, and fall back to the same BLE status surface
 * radar uses so a unit can see whether Bluetooth relay is an option too.
 *
 * The contact chips below don't split the channel into real private DMs —
 * there's no per-recipient scoping in the backend, everyone still sees
 * everything. Selecting a contact just filters *this device's view* down to
 * messages between you and them, so it reads like chatting with one unit
 * without needing a schema change for real 1:1 channels.
 */
export function Komunikasi() {
  const entries = useCommsLogStore((s) => s.entries);
  const loaded = useCommsLogStore((s) => s.loaded);
  const append = useCommsLogStore((s) => s.append);
  const loadHistory = useCommsLogStore((s) => s.loadHistory);
  const online = useOnlineStatus();
  const { coords } = useDeviceLocation();
  const [draft, setDraft] = useState("");
  const [self] = useState(getSelfRanger);
  const [contact, setContact] = useState<string>(ALL_CONTACTS);
  const endRef = useRef<HTMLDivElement>(null);

  const selfLabel = `${self.name} (${self.callsign})`;

  const requestBackup = () => {
    const posSuffix = coords
      ? ` Posisi: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}.`
      : "";
    append({
      sender: selfLabel,
      color: "#FF0040",
      lead: "MINTA BACKUP",
      body: `butuh bantuan tambahan segera di lokasi saat ini.${posSuffix}`,
    });
  };

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const baselineCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (loaded && baselineCountRef.current === null) {
      baselineCountRef.current = useCommsLogStore.getState().entries.length;
    }
  }, [loaded]);

  const contacts = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      if (e.sender !== selfLabel) seen.add(e.sender);
    }
    return Array.from(seen);
  }, [entries, selfLabel]);

  const visibleEntries = useMemo(() => {
    if (contact === ALL_CONTACTS) return entries;
    return entries.filter((e) => e.sender === contact || e.sender === selfLabel);
  }, [entries, contact, selfLabel]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [visibleEntries.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    append({
      sender: selfLabel,
      color: SELF_COLOR,
      lead: "LAPANGAN",
      body: text,
    });
    setDraft("");
  };

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#131313] flex flex-col">
      <header className="bg-[#262626] border-b-2 border-[#444] shrink-0">
        <div className="px-4 pt-3 pb-2 flex justify-between items-center">
          <div>
            <h1 className="font-grotesk font-bold text-xl text-[#e5e2e1]">
              Komunikasi Taktis
            </h1>
            <p className="font-mono text-xs text-[#66df75] mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#66df75] animate-pulse" />
              {self.name} ({self.callsign}) — Enkripsi aktif.
            </p>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 border border-[#66df75] bg-[#66df75]/10">
            <span className="font-mono text-[9px] text-[#66df75] tracking-wider">ENKRIPSI AKTIF</span>
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-2.5">
          <a
            href={`tel:${EMERGENCY_TEL}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#FF0040] bg-[#FF0040]/10 text-[#FF0040] font-mono text-[10px] uppercase tracking-wide active:scale-95 transition-transform"
          >
            <PhoneCall size={12} /> Telepon Medis ({EMERGENCY_TEL})
          </a>
          <button
            type="button"
            onClick={requestBackup}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#fabd00] bg-[#fabd00]/10 text-[#fabd00] font-mono text-[10px] uppercase tracking-wide active:scale-95 transition-transform"
          >
            <Siren size={12} /> Minta Backup
          </button>
        </div>

        <div className="flex gap-1.5 px-4 pb-2.5 overflow-x-auto">
          {[ALL_CONTACTS, ...contacts].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setContact(c)}
              className={`shrink-0 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide border transition-colors ${
                contact === c
                  ? "border-[#ffb2bd] text-[#ffb2bd] bg-[#ffb2bd]/10"
                  : "border-[#333] text-[#666] hover:border-[#555] hover:text-[#999]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      {!online && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[#93000a]/20 border-b border-[#FF0040]/40 font-mono text-[10px] text-[#ff8fa3]">
          <WifiOff size={11} />
          <span className="uppercase tracking-wide">
            Koneksi utama terputus — pesan tertunda, tersimpan otomatis, terkirim saat online kembali.
          </span>
        </div>
      )}

      <BluetoothStatusBar />

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 pt-4 pb-2 text-sm">
        {!loaded && (
          <span className="font-mono text-[10px] text-[#555] flex items-center gap-1.5">
            <Radio size={11} className="animate-pulse" /> memuat log komunikasi...
          </span>
        )}
        {visibleEntries.map((entry, i) => (
          <ChatBubble
            key={i}
            entry={entry}
            selfLabel={selfLabel}
            animate={baselineCountRef.current !== null && entries.indexOf(entry) >= baselineCountRef.current}
          />
        ))}
        <div ref={endRef} />
      </div>

      <div className="bg-[#131313] border-t border-[#444] px-3 py-2 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <input
              value={draft}
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full bg-black border border-[#444] text-[#e5e2e1] font-mono text-sm focus:ring-0 focus:border-[#ffb2bd] px-3 py-2.5 placeholder:text-[#e1bec2]/50 transition-colors"
              placeholder="Ketik laporan taktis..."
              type="text"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
