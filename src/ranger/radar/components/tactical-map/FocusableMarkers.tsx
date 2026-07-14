import { Marker, useMap } from "react-leaflet";
import { useIncidents } from "@/hooks/useIncidents";
import { buildHazardIcon, EPICENTER_ICON, EPICENTER_OFFSET } from "./mapIcons";
import { type FlarePhase, ACTIVE_DRILL_PHASES } from "./FlareSequence";

/**
 * Every hazard/epicenter marker, clickable to bring "all eyes" to it — flies
 * the camera in tight on whatever the operator taps, manual rather than
 * automatic so it doesn't yank the view around on its own for the always-on
 * minor hazards.
 */
export function FocusableMarkers({ ranger, phase }: { ranger: { lat: number; lon: number }; phase: FlarePhase }) {
  const map = useMap();
  const focus = (pos: [number, number]) => map.flyTo(pos, 18, { duration: 1 });
  const minimizeMinorHazards = ACTIVE_DRILL_PHASES.includes(phase);
  const { data: hazards = [] } = useIncidents();

  return (
    <>
      {hazards.map((hazard) => {
        const pos: [number, number] = [ranger.lat + hazard.offset[0], ranger.lon + hazard.offset[1]];
        const icon = buildHazardIcon(hazard.kind, hazard.label, minimizeMinorHazards);
        return (
          <Marker
            key={hazard.id}
            position={pos}
            icon={icon}
            eventHandlers={{ click: () => focus(pos) }}
          />
        );
      })}

      {phase !== "idle" &&
        (() => {
          const pos: [number, number] = [
            ranger.lat + EPICENTER_OFFSET[0],
            ranger.lon + EPICENTER_OFFSET[1],
          ];
          return (
            <Marker position={pos} icon={EPICENTER_ICON} eventHandlers={{ click: () => focus(pos) }} />
          );
        })()}
    </>
  );
}
