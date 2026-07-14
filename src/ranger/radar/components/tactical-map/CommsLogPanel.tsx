import { useEffect, useRef, useState } from "preact/hooks";
import { MessageSquare } from "lucide-preact";
import { useCommsLogStore } from "@/store/commsLog";

export function CommsLogPanel() {
  const entries = useCommsLogStore((s) => s.entries);
  const append = useCommsLogStore((s) => s.append);
  const loadHistory = useCommsLogStore((s) => s.loadHistory);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Load comms history from backend on first mount
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [entries.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    append({ sender: "ANDA", color: "#ffb2bd", lead: "PERINTAH", body: text });
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

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4 text-sm">
        {entries.map((entry, i) => (
          <p key={i} className="leading-5">
            <span className="text-[#ffb2bd]">[{entry.time}]</span>{" "}
            <span style={{ color: entry.color }} className="uppercase">
              {entry.sender}: {entry.lead}
            </span>{" "}
            <span className="text-[#e1bec2]">{entry.body}</span>
          </p>
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
