import { Marker, Polyline, useMap } from "react-leaflet";
import { useTasksStore } from "@/store/tasks";
import { usePersonnel } from "@/hooks/usePersonnel";
import { buildRangerIcon } from "./mapIcons";

/**
 * Ad-hoc ranger tasks (`src/store/tasks.ts`) — the general "Budi takes the
 * crash" case, independent of the FLARE drill. One marker + route per active
 * task, smoothly gliding (see `animateAlongRoute`), left on the map once
 * arrived.
 */
export function TaskMarkers() {
  const tasks = useTasksStore((s) => s.tasks);
  const map = useMap();
  const focus = (pos: [number, number]) => map.flyTo(pos, 18, { duration: 1 });
  const { data: personnel = [] } = usePersonnel();

  return (
    <>
      {Object.values(tasks).flatMap((task) => {
        const rangerProfile = personnel.find((r) => r.id === task.rangerId);
        const label = rangerProfile
          ? task.status === "arrived"
            ? `${rangerProfile.name} · TIBA`
            : rangerProfile.name
          : "";
        const layers = [];
        // Minor ad-hoc hazards (fire/crash/theft/etc.) are the routine, not
        // the drama — kept thin and dim, not the bright flowing style
        // reserved for major FLARE emergencies, and cleared entirely on
        // arrival (see src/store/tasks.ts) rather than lingering.
        if (task.route.length > 1) {
          layers.push(
            <Polyline
              key={`${task.hazardId}-route`}
              positions={task.route}
              pathOptions={{ color: "#66df75", weight: 1.5, opacity: 0.4, dashArray: "4 6" }}
            />,
          );
        }
        layers.push(
          <Marker
            key={`${task.hazardId}-marker`}
            position={task.unitPos}
            icon={buildRangerIcon(label)}
            eventHandlers={{ click: () => focus(task.unitPos) }}
          />,
        );
        return layers;
      })}
    </>
  );
}
