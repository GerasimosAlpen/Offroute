import { useEffect, useState } from "preact/hooks";
import { Marker, Popup } from "react-leaflet";
import { useVictimsStore } from "@/store/victims";
import { RANGERS } from "@/lib/rangers";
import type { Victim } from "@/lib/api";
import { buildSosIcon } from "./mapIcons";

function formatAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs} detik lalu`;
  const mins = Math.floor(secs / 60);
  return `${mins} menit lalu`;
}

function VictimPopupBody({ victim }: { victim: Victim }) {
  const [pickedRanger, setPickedRanger] = useState(RANGERS[0].id);
  const pending = Boolean(victim.reportedRangerId);

  return (
    <div className="font-mono text-xs flex flex-col gap-2 min-w-[200px]">
      <div className="flex flex-col gap-1">
        <span className="font-bold text-[#131313]">{victim.label || "Tidak dikenal"}</span>
        <span>Sinyal SOS aktif dari lokasi ini.</span>
        <span className="text-[10px] text-zinc-500">Terakhir lapor {formatAgo(victim.lastSeenAt)}</span>
        {victim.assignedRangerId && (
          <span className="text-[10px] text-sky-600">
            Menuju: {victim.assignedRangerName} ({victim.assignedCallsign})
          </span>
        )}
      </div>

      {pending ? (
        <div className="flex flex-col gap-1.5 bg-amber-50 border border-amber-400 p-2">
          <span className="text-[10px] text-amber-800">
            {victim.reportedRangerName} ({victim.reportedCallsign}) melapor korban aman — perlu konfirmasi.
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void useVictimsStore.getState().confirmRescue(victim.id)}
              className="flex-1 text-[10px] uppercase tracking-wide text-[#66df75] border border-[#66df75] px-2 py-1 hover:bg-[#66df75]/10"
            >
              Terima
            </button>
            <button
              type="button"
              onClick={() => void useVictimsStore.getState().rejectReport(victim.id)}
              className="flex-1 text-[10px] uppercase tracking-wide text-[#ff0040] border border-[#ff0040] px-2 py-1 hover:bg-[#ff0040]/10"
            >
              Tolak
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <select
            value={pickedRanger}
            onChange={(e) => setPickedRanger((e.target as HTMLSelectElement).value)}
            className="flex-1 text-[10px] border border-zinc-300 px-1.5 py-1"
          >
            {RANGERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.callsign})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const ranger = RANGERS.find((r) => r.id === pickedRanger);
              if (!ranger) return;
              void useVictimsStore
                .getState()
                .assignRanger(victim.id, { rangerId: ranger.id, rangerName: ranger.name, callsign: ranger.callsign });
            }}
            className="shrink-0 text-[10px] uppercase tracking-wide text-sky-700 border border-sky-700 px-2 py-1 hover:bg-sky-50"
          >
            Kirim Unit
          </button>
        </div>
      )}
    </div>
  );
}

/** Real SOS pings from `/sos` — a person's own phone GPS, not a simulated drill detection. */
export function VictimMarkers() {
  const active = useVictimsStore((s) => s.active);
  const loadActive = useVictimsStore((s) => s.loadActive);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  return (
    <>
      {active.map((victim) => (
        <Marker key={victim.id} position={[victim.lat, victim.lon]} icon={buildSosIcon(victim.label ?? "Tidak dikenal")}>
          <Popup>
            <VictimPopupBody victim={victim} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}
