import { Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import type { Ranger } from "@/lib/rangers";
import { buildRangerIcon, VICTIM_ICON } from "../mapIcons";
import { TRAIL_LENGTH, type BackupUnitsState, type EvacRouteState } from "./useFlareChoreography";

interface FlareLayersProps {
  personnel: Ranger[];
  revealedMesh: Ranger[];
  dispatchedId: string | null;
  unitPos: [number, number] | null;
  trail: [number, number][];
  route: [number, number][] | null;
  evacRoutes: EvacRouteState[];
  victim: [number, number] | null;
  backupUnits: BackupUnitsState;
  focusedId: string | null;
  setFocusedId: (updater: (prev: string | null) => string | null) => void;
  posOf: (r: Ranger) => [number, number];
}

/** Pure Leaflet rendering of whatever state the FLARE choreography is in — no timing or logic of its own. */
export function FlareLayers({
  personnel,
  revealedMesh,
  dispatchedId,
  unitPos,
  trail,
  route,
  evacRoutes,
  victim,
  backupUnits,
  focusedId,
  setFocusedId,
  posOf,
}: FlareLayersProps) {
  const map = useMap();

  return (
    <>
      {revealedMesh
        .filter((node) => node.id !== dispatchedId && !(node.id in backupUnits))
        .map((node) => (
          <Marker
            key={node.id}
            position={posOf(node)}
            icon={buildRangerIcon(`${node.name} · BT`)}
          />
        ))}

      {evacRoutes
        .filter((r) => r.rangerId !== dispatchedId)
        .map((r) => (
          <Polyline
            key={r.rangerId}
            positions={r.route}
            pathOptions={
              r.blocked
                ? { color: "#ff0040", weight: 2, opacity: 0.4, dashArray: "2 6" }
                : { color: "#5fb3b3", weight: 2, opacity: 0.35, dashArray: "4 8" }
            }
          />
        ))}

      {route && (
        <Polyline
          positions={route}
          pathOptions={{ color: "#5fb3b3", weight: 3, dashArray: "10 8", className: "route-flow" }}
        />
      )}

      {trail.map((pos, i) => (
        <CircleMarker
          key={i}
          center={pos}
          radius={2 + (i / TRAIL_LENGTH) * 4}
          pathOptions={{
            color: "#5fb3b3",
            fillColor: "#5fb3b3",
            fillOpacity: (i / TRAIL_LENGTH) * 0.5,
            opacity: (i / TRAIL_LENGTH) * 0.5,
            weight: 1,
          }}
        />
      ))}

      {unitPos && dispatchedId && (
        <Marker
          position={unitPos}
          icon={buildRangerIcon(personnel.find((n) => n.id === dispatchedId)?.name ?? "")}
        />
      )}

      {Object.entries(backupUnits).flatMap(([id, unit]) => {
        const node = personnel.find((r) => r.id === id);
        if (!node) return [];
        const layers = [];
        // Only the focused unit's route is drawn — with several units
        // moving at once, drawing every route at the same time would be a
        // tangle of waypoints. Click a unit to focus it (shows its route,
        // flies the camera in); click it again to un-focus.
        if (focusedId === id && unit.route.length > 1) {
          layers.push(
            <Polyline
              key={`${id}-route`}
              positions={unit.route}
              pathOptions={{ color: "#fabd00", weight: 2, opacity: 0.6, dashArray: "4 6" }}
            />,
          );
        }
        layers.push(
          <Marker
            key={`${id}-marker`}
            position={unit.pos}
            icon={buildRangerIcon(node.name)}
            eventHandlers={{
              click: () => {
                setFocusedId((prev) => (prev === id ? null : id));
                map.flyTo(unit.pos, 17, { duration: 1 });
              },
            }}
          />,
        );
        return layers;
      })}

      {victim && <Marker position={victim} icon={VICTIM_ICON} />}
    </>
  );
}
