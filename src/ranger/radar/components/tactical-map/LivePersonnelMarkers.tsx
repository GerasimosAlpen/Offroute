import { Marker } from "react-leaflet";
import { usePresenceStore } from "@/store/presence";
import { useTasksStore } from "@/store/tasks";
import { buildRangerIcon } from "./mapIcons";

/**
 * Every online personel unit that shared a real GPS fix via its presence
 * heartbeat, drawn where it physically is right now — the realtime
 * cross-device tracking layer. Units currently animated by an active
 * dispatch are skipped (TaskMarkers owns those, at higher fidelity).
 */
export function LivePersonnelMarkers() {
  const units = usePresenceStore((s) => s.units);
  const tasks = useTasksStore((s) => s.tasks);

  // Any ranger with a live task (moving, on scene, or awaiting confirmation)
  // is drawn by TaskMarkers at higher fidelity — don't double-plot them.
  const taskedRangerIds = new Set(Object.values(tasks).map((t) => t.rangerId));

  return (
    <>
      {Object.values(units)
        .filter((u) => typeof u.lat === "number" && typeof u.lon === "number" && !taskedRangerIds.has(u.rangerId))
        .map((u) => (
          <Marker
            key={u.rangerId}
            position={[u.lat!, u.lon!]}
            icon={buildRangerIcon(`${u.name} · LIVE`)}
          />
        ))}
    </>
  );
}
