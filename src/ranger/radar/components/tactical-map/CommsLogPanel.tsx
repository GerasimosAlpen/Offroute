import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { MessageSquare, CheckCircle2, RotateCcw, Radio } from "lucide-preact";
import { useCommsLog } from "@/hooks/useCommsLog";
import { useBluetoothStore } from "@/store/bluetooth";
import { useTasksStore } from "@/store/tasks";
import { useIncidents } from "@/hooks/useIncidents";
import { CommMessage } from "@/ranger/comms/CommMessage";
import { BluetoothStatusBar } from "@/ranger/comms/BluetoothStatusBar";

const ALL_FREQ = "SEMUA";

/**
 * Radar's Comm Center — the coordination hub. One shared wire with every
 * field unit (and the /sos + personel apps), plus:
 *  - pending completion reports surface as actionable cards (Konfirmasi /
 *    Kembalikan) right where the operator is already reading traffic, so the
 *    two-step task handshake closes without hunting through panels;
 *  - a per-unit "frequency" filter narrows the log to one unit's thread.
 * Operator messages are sent as HQ (never "ANDA").
 */
export function CommsLogPanel() {
  const { entries, append, baselineCountRef } = useCommsLog();
  const [draft, setDraft] = useState("");
  const [freq, setFreq] = useState<string>(ALL_FREQ);
  const endRef = useRef<HTMLDivElement>(null);

  const tasks = useTasksStore((s) => s.tasks);
  const confirmDone = useTasksStore((s) => s.confirmDone);
  const rejectDone = useTasksStore((s) => s.rejectDone);
  const { data: hazards = [] } = useIncidents();

  const pending = useMemo(() => Object.values(tasks).filter((t) => t.status === "reported"), [tasks]);
  const hazardLabel = (hazardId: string) => hazards.find((h) => h.id === hazardId)?.label ?? hazardId;

  // Frequencies = the distinct field units that have appeared on the wire,
  // so the operator can tune to one unit's channel.
  const frequencies = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      if (e.sender !== "HQ" && e.sender !== "PUSAT" && e.sender !== "SISTEM") seen.add(e.sender);
    }
    return Array.from(seen);
  }, [entries]);

  const visible = useMemo(() => {
    const indexed = entries.map((entry, logIndex) => ({ entry, logIndex }));
    if (freq === ALL_FREQ) return indexed;
    // A unit's channel: their own traffic + HQ/system lines (both sides of it).
    return indexed.filter(({ entry: e }) => e.sender === freq || e.sender === "HQ" || e.sender === "PUSAT" || e.sender === "SISTEM");
  }, [entries, freq]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [visible.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    // Directed at the tuned unit when a frequency is selected, broadcast otherwise.
    const body = freq === ALL_FREQ ? text : `${freq}, ${text}`;
    append({ sender: "HQ", color: "#ffb2bd", lead: "PERINTAH", body });

    // Best-effort BLE relay to any connected NUS peripheral (Tier 1 only).
    const connected = useBluetoothStore.getState().devices.filter((d) => d.connected);
    for (const device of connected) {
      void useBluetoothStore.getState().sendMessage(device.id, body);
    }

    setDraft("");
  };

  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-9 flex items-center gap-2 px-4 bg-[#131313] border-b border-[#444]">
        <MessageSquare size={12} className="text-[#e5e2e1]" />
        <span className="text-[#e5e2e1] text-sm tracking-[1.4px] uppercase">Comm Center</span>
        {pending.length > 0 && (
          <span className="ml-auto font-mono text-[10px] text-[#fabd00] border border-[#fabd00]/50 bg-[#fabd00]/10 px-1.5 py-0.5 uppercase tracking-wide">
            {pending.length} perlu konfirmasi
          </span>
        )}
      </header>

      <BluetoothStatusBar />

      {/* Pending completion reports — confirm/reject inline. */}
      {pending.length > 0 && (
        <div className="shrink-0 flex flex-col gap-1.5 p-2 border-b border-[#444] bg-[#1a1a1a] max-h-40 overflow-y-auto">
          {pending.map((t) => (
            <div key={t.hazardId} className="border border-[#fabd00]/40 bg-[#fabd00]/5 p-2 flex flex-col gap-1.5">
              <div className="font-mono text-[10px] text-[#fabd00] uppercase tracking-wide leading-snug">
                {t.rangerName} ({t.callsign}) lapor selesai
                <span className="text-[#888]"> · {hazardLabel(t.hazardId)}</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => confirmDone(t.hazardId)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 border border-[#66df75] bg-[#66df75]/10 text-[#66df75] font-mono text-[10px] uppercase tracking-wide hover:brightness-125 active:scale-95 transition-all"
                >
                  <CheckCircle2 size={11} /> Konfirmasi
                </button>
                <button
                  type="button"
                  onClick={() => rejectDone(t.hazardId)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 border border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] font-mono text-[10px] uppercase tracking-wide hover:brightness-125 active:scale-95 transition-all"
                >
                  <RotateCcw size={11} /> Kembalikan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Frequency selector — tune to one unit's channel. */}
      {frequencies.length > 0 && (
        <div className="shrink-0 flex gap-1.5 px-2 py-1.5 overflow-x-auto border-b border-[#444] bg-[#131313]">
          {[ALL_FREQ, ...frequencies].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFreq(f)}
              className={`shrink-0 flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide border transition-colors ${
                freq === f
                  ? "border-[#5fb3b3] text-[#5fb3b3] bg-[#5fb3b3]/10"
                  : "border-[#333] text-[#666] hover:border-[#555] hover:text-[#999]"
              }`}
            >
              {f !== ALL_FREQ && <Radio size={9} />}
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4 text-sm">
        {visible.map(({ entry, logIndex }) => (
          <CommMessage
            key={logIndex}
            entry={entry}
            animate={baselineCountRef.current !== null && logIndex >= baselineCountRef.current}
          />
        ))}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 bg-[#131313] border-t border-[#444] px-3 py-2 flex items-center gap-2">
        <span className="text-[#666] text-sm">›</span>
        <input
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={freq === ALL_FREQ ? "Perintah ke semua unit..." : `Perintah ke ${freq}...`}
          className="flex-1 bg-transparent text-[#e5e2e1] text-sm placeholder:text-[#555] outline-none"
        />
      </div>
    </div>
  );
}
