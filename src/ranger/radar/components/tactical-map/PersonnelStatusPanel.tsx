import { useEffect, useRef, useState } from "preact/hooks";
import { Users, TriangleAlert } from "lucide-preact";
import { RANGERS } from "@/lib/rangers";
import { usePresenceStore } from "@/store/presence";
import { raiseAlert } from "@/lib/alerts";
import { formatRelativeAge } from "@/lib/format";

const SILENT_THRESHOLD_MS = 90_000; // several missed heartbeats — worth flagging, not just stale

type UnitStatus = "online" | "silent" | "offline";

function statusOf(lastSeen: number | undefined, now: number): UnitStatus {
  if (lastSeen === undefined) return "offline";
  // Anything under the silent threshold counts as online — a heartbeat or
  // two of lag isn't worth alarming over.
  return now - lastSeen <= SILENT_THRESHOLD_MS ? "online" : "silent";
}

const STATUS_STYLE: Record<UnitStatus, { dot: string; label: string; text: string }> = {
  online: { dot: "bg-[#66df75]", label: "AKTIF", text: "text-[#66df75]" },
  silent: { dot: "bg-[#fabd00] animate-pulse", label: "SUNYI", text: "text-[#fabd00]" },
  offline: { dot: "bg-[#555]", label: "OFFLINE", text: "text-[#666]" },
};

/**
 * Live per-unit connectivity, not just static markers — presence comes from
 * `usePresenceStore` (personel heartbeats every 20s over the socket already
 * used for everything else). A unit that's connected-but-silent for a while
 * is a real safety signal worth surfacing, not just a nicety: something may
 * be wrong even if they haven't formally disconnected.
 *
 * Deliberately doesn't show a battery percentage — the personel side is a
 * plain mobile browser (Safari included), and the Battery Status API isn't
 * available cross-browser (Safari never implemented it), so a number here
 * would be fabricated. Connectivity + last-seen is the honest signal.
 */
export function PersonnelStatusPanel() {
  const units = usePresenceStore((s) => s.units);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Fire an alert once per silence event, not once per 5s re-render tick.
  const lastStatusRef = useRef<Record<string, UnitStatus>>({});
  useEffect(() => {
    for (const ranger of RANGERS) {
      const status = statusOf(units[ranger.id]?.lastSeen, now);
      const prev = lastStatusRef.current[ranger.id];
      if (status === "silent" && prev !== "silent") {
        raiseAlert(
          "Unit gagal lapor",
          `${ranger.name} (${ranger.callsign}) belum lapor lebih dari ${Math.round(SILENT_THRESHOLD_MS / 60_000)} menit.`,
        );
      }
      lastStatusRef.current[ranger.id] = status;
    }
  }, [units, now]);

  const silentCount = RANGERS.filter((r) => statusOf(units[r.id]?.lastSeen, now) === "silent").length;

  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-9 flex items-center gap-2 px-4 bg-[#131313] border-b border-[#444]">
        <Users size={13} className="text-[#e5e2e1]" />
        <span className="text-[#e5e2e1] text-sm tracking-[1.4px] uppercase">
          Status Personel
        </span>
        {silentCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[#fabd00] text-xs">
            <TriangleAlert size={11} /> {silentCount} sunyi
          </span>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-3">
        {RANGERS.map((ranger) => {
          const presence = units[ranger.id];
          const status = statusOf(presence?.lastSeen, now);
          const style = STATUS_STYLE[status];
          return (
            <div
              key={ranger.id}
              className="shrink-0 bg-[#131313] border-l-4 py-2 pl-3 pr-3 flex items-center justify-between gap-2"
              style={{ borderLeftColor: status === "online" ? "#66df75" : status === "silent" ? "#fabd00" : "#444" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`size-1.5 rounded-full shrink-0 ${style.dot}`} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[#e5e2e1] text-xs truncate">
                    {ranger.name} <span className="text-[#888]">({ranger.callsign})</span>
                  </span>
                  <span className="text-[#666] text-[10px]">
                    {presence ? formatRelativeAge(presence.lastSeen, now) : "belum pernah lapor"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className={`text-[10px] uppercase tracking-wide ${style.text}`}>
                  {style.label}
                </span>
                {presence && (
                  <span className={`text-[9px] uppercase tracking-wide ${presence.dutyStatus === "idle" ? "text-[#5fb3b3]" : "text-[#888]"}`}>
                    {presence.dutyStatus === "idle" ? "IDLE" : "BERTUGAS"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
