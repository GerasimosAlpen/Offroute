import { TriangleAlert } from "lucide-preact";
import type { HazardSeverity } from "@/lib/hazards";
import type { Ranger } from "@/lib/rangers";
import { useTasksStore } from "@/store/tasks";
import { useDeviceLocation } from "@/store/location";
import { useIncidents } from "@/hooks/useIncidents";
import { usePersonnel } from "@/hooks/usePersonnel";

const SEVERITY_COLOR: Record<HazardSeverity, string> = {
  critical: "#ff0040",
  warning: "#fabd00",
  info: "#66df75",
};

export function HazardStatusPanel() {
  const { coords } = useDeviceLocation();
  const tasks = useTasksStore((s) => s.tasks);
  const resolvedHazards = useTasksStore((s) => s.resolvedHazards);
  const assign = useTasksStore((s) => s.assign);
  const confirmDone = useTasksStore((s) => s.confirmDone);
  const rejectDone = useTasksStore((s) => s.rejectDone);

  // Live data from backend (falls back to static mocks while loading/offline)
  const { data: hazards = [] } = useIncidents();
  const { data: personnel = [] } = usePersonnel();

  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-9 flex items-center gap-2 px-4 bg-[#131313] border-b border-[#444]">
        <TriangleAlert size={13} className="text-[#e5e2e1]" />
        <span className="text-[#e5e2e1] text-sm tracking-[1.4px] uppercase">
          Status Taktis
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">
        {hazards.map((hazard) => {
          const task = tasks[hazard.id];
          const resolved = resolvedHazards[hazard.id];
          const rangerId = task?.rangerId ?? resolved?.rangerId;
          const rangerProfile = rangerId
            ? (personnel as Array<{ id: string; name: string; callsign: string }>).find((r) => r.id === rangerId)
            : undefined;

          return (
            <div
              key={hazard.id}
              className="shrink-0 bg-[#131313] border-l-4 py-3 pl-4 pr-3 flex flex-col gap-1"
              style={{ borderLeftColor: SEVERITY_COLOR[hazard.severity] }}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="text-sm uppercase leading-5"
                  style={{ color: SEVERITY_COLOR[hazard.severity] }}
                >
                  {hazard.label}
                </span>
                <span className="text-[#e1bec2] text-xs shrink-0">{hazard.time}</span>
              </div>
              <p className="text-[#e1bec2] text-xs leading-4">{hazard.description}</p>

              {(() => {
                const who = rangerProfile
                  ? `${rangerProfile.name} (${rangerProfile.callsign})`
                  : task
                    ? `${task.rangerName} (${task.callsign})`
                    : resolved
                      ? `${resolved.rangerName} (${resolved.callsign})`
                      : "";

                // Resolved — radar already confirmed this one.
                if (resolved && !task) {
                  return (
                    <p className="text-[#66df75] text-xs pt-1 uppercase tracking-[0.5px]">
                      Selesai · dikonfirmasi · {who}
                    </p>
                  );
                }

                // A unit reported done — radar must confirm or send back.
                if (task?.status === "reported") {
                  return (
                    <div className="flex flex-col gap-2 pt-1">
                      <p className="text-[#fabd00] text-xs uppercase tracking-[0.5px]">
                        {who} lapor selesai · perlu konfirmasi
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmDone(hazard.id)}
                          className="border border-[#66df75] bg-[#66df75]/10 text-[#66df75] text-xs uppercase px-2.5 py-1.5"
                        >
                          Konfirmasi
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectDone(hazard.id)}
                          className="border border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] text-xs uppercase px-2.5 py-1.5"
                        >
                          Kembalikan
                        </button>
                      </div>
                    </div>
                  );
                }

                // A unit is enroute or on scene — no second unit, just status.
                if (task) {
                  const label =
                    task.status === "onscene"
                      ? `${who} di lokasi, menangani`
                      : `${who} menuju lokasi...`;
                  return (
                    <p className="text-[#5fb3b3] text-xs pt-1 uppercase tracking-[0.5px]">
                      {task.selfAssigned ? "MANDIRI · " : ""}{label}
                    </p>
                  );
                }

                // No unit yet — radar can dispatch.
                return (
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={!coords}
                      onClick={() =>
                        coords &&
                        assign(hazard.id, coords, {
                          hazards,
                          personnel: personnel as unknown as Ranger[],
                        })}
                      className="border border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] text-xs uppercase px-2.5 py-1.5 disabled:opacity-40"
                    >
                      Kirim Unit
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
