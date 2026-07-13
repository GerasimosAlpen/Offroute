import { TriangleAlert } from "lucide-preact";
import { HAZARDS, type HazardSeverity } from "@/lib/hazards";
import { RANGERS } from "@/lib/rangers";
import { useTasksStore } from "@/store/tasks";
import { useDeviceLocation } from "@/store/location";

const SEVERITY_COLOR: Record<HazardSeverity, string> = {
  critical: "#ff0040",
  warning: "#fabd00",
  info: "#66df75",
};

export function HazardStatusPanel() {
  const { coords } = useDeviceLocation();
  const tasks = useTasksStore((s) => s.tasks);
  const assign = useTasksStore((s) => s.assign);

  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-9 flex items-center gap-2 px-4 bg-[#131313] border-b border-[#444]">
        <TriangleAlert size={13} className="text-[#e5e2e1]" />
        <span className="text-[#e5e2e1] text-sm tracking-[1.4px] uppercase">
          Status Taktis
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">
        {HAZARDS.map((hazard) => {
          const task = tasks[hazard.id];
          const rangerProfile = task ? RANGERS.find((r) => r.id === task.rangerId) : undefined;

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

              {rangerProfile ? (
                <p className="text-[#5fb3b3] text-xs pt-1 uppercase tracking-[0.5px]">
                  {task!.status === "arrived"
                    ? `${rangerProfile.name} (${rangerProfile.callsign}) tiba di lokasi`
                    : `${rangerProfile.name} (${rangerProfile.callsign}) menuju lokasi...`}
                </p>
              ) : (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="border border-[#444] text-[#e5e2e1] text-xs uppercase px-2.5 py-1.5"
                  >
                    Detail
                  </button>
                  <button
                    type="button"
                    disabled={!coords}
                    onClick={() => coords && assign(hazard.id, coords)}
                    className="border border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] text-xs uppercase px-2.5 py-1.5 disabled:opacity-40"
                  >
                    Kirim Unit
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
