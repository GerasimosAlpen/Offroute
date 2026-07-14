import { useEffect, useRef, useState } from "preact/hooks";
import { MessageSquare } from "lucide-preact";
import { useCommsLogStore } from "@/store/commsLog";
import { useBluetoothStore } from "@/store/bluetooth";
import { CommMessage } from "@/ranger/comms/CommMessage";
import { BluetoothStatusBar } from "@/ranger/comms/BluetoothStatusBar";

export function CommsLogPanel() {
  const entries = useCommsLogStore((s) => s.entries);
  const loaded = useCommsLogStore((s) => s.loaded);
  const append = useCommsLogStore((s) => s.append);
  const loadHistory = useCommsLogStore((s) => s.loadHistory);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Load comms history from backend on first mount
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Marks the point history hydration ended — only entries appended *after*
  // this (self-sent, or arriving live from another client) play the
  // encrypt/decrypt reveal; the history itself just renders in plainly,
  // it shouldn't all flash-decrypt the moment the panel opens.
  const baselineCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (loaded && baselineCountRef.current === null) {
      baselineCountRef.current = useCommsLogStore.getState().entries.length;
    }
  }, [loaded]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [entries.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    append({ sender: "ANDA", color: "#ffb2bd", lead: "PERINTAH", body: text });

    // Best-effort: also relay over BLE to whatever's currently connected —
    // a real second channel (see src/store/bluetooth.ts), not just cosmetic,
    // though it only ever reaches an actual connected NUS peripheral (Tier
    // 1 central/client only, no Offroute-to-Offroute link yet).
    const connected = useBluetoothStore.getState().devices.filter((d) => d.connected);
    for (const device of connected) {
      void useBluetoothStore.getState().sendMessage(device.id, text);
    }

    setDraft("");
  };

  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-9 flex items-center gap-2 px-4 bg-[#131313] border-b border-[#444]">
        <MessageSquare size={12} className="text-[#e5e2e1]" />
        <span className="text-[#e5e2e1] text-sm tracking-[1.4px] uppercase">
          Log Komunikasi
        </span>
      </header>

      <BluetoothStatusBar />

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4 text-sm">
        {entries.map((entry, i) => (
          <CommMessage
            key={i}
            entry={entry}
            animate={baselineCountRef.current !== null && i >= baselineCountRef.current}
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
          placeholder="Masukkan perintah taktis..."
          className="flex-1 bg-transparent text-[#e5e2e1] text-sm placeholder:text-[#555] outline-none"
        />
      </div>
    </div>
  );
}
