import { useEffect, useState } from "preact/hooks";
import { LifeBuoy, ChevronUp, ChevronDown } from "lucide-preact";
import { useVictimsStore } from "@/store/victims";
import { getSelfRanger } from "@/lib/rangers";

function distanceLabel(userPos: [number, number], lat: number, lon: number): string {
  const R = 6371000;
  const dLat = ((lat - userPos[0]) * Math.PI) / 180;
  const dLon = ((lon - userPos[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((userPos[0] * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.sqrt(a));
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/**
 * A separate overlay rather than woven into PetaTaktis's own map JSX —
 * that page's route-search cinematic is tightly coupled state, and this
 * needs to stay additive so it can't destabilize it. Lists real active SOS
 * pings (not the page's own simulated EVENTS) with a way to report one
 * found/secured, which radar must then confirm before it's truly resolved.
 */
export function VictimSosDrawer({ userPos }: { userPos: [number, number] }) {
  const active = useVictimsStore((s) => s.active);
  const loadActive = useVictimsStore((s) => s.loadActive);
  const reportFound = useVictimsStore((s) => s.reportFound);
  const [open, setOpen] = useState(false);
  const [self] = useState(getSelfRanger);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  if (active.length === 0) return null;

  const unconfirmedCount = active.filter((v) => !v.reportedRangerId).length;

  return (
    <div className="absolute bottom-3 left-3 z-[1000] max-w-[280px] w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[#131313] border border-[#ff0040] text-[#ff0040] font-mono text-[10px] uppercase tracking-wide"
      >
        <LifeBuoy size={12} className="animate-pulse" />
        {active.length} Sinyal SOS Aktif
        {unconfirmedCount > 0 && <span className="text-[#fabd00]">({unconfirmedCount} belum dilaporkan)</span>}
        {open ? <ChevronDown size={12} className="ml-auto" /> : <ChevronUp size={12} className="ml-auto" />}
      </button>

      {open && (
        <div className="bg-[#131313] border border-t-0 border-[#444] max-h-56 overflow-y-auto flex flex-col">
          {active.map((victim) => (
            <div key={victim.id} className="px-3 py-2 border-b border-[#333] flex flex-col gap-1 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#e5e2e1] text-xs truncate">{victim.label || "Tidak dikenal"}</span>
                <span className="text-[#666] text-[10px] shrink-0">{distanceLabel(userPos, victim.lat, victim.lon)}</span>
              </div>
              {victim.reportedRangerId ? (
                <span className="text-[10px] text-[#fabd00]">
                  Menunggu konfirmasi PUSAT ({victim.reportedRangerName})
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void reportFound(victim.id, { rangerId: self.id, rangerName: self.name, callsign: self.callsign })
                  }
                  className="self-start text-[10px] uppercase tracking-wide text-[#66df75] border border-[#66df75] px-2 py-1 hover:bg-[#66df75]/10"
                >
                  Laporkan Ditemukan / Aman
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
