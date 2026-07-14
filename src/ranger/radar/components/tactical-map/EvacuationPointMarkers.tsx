import { Marker, Polyline, Popup } from "react-leaflet";
import { useEvacuationPointsStore } from "@/store/evacuationPoints";
import { EVAC_POINT_ICON } from "./mapIcons";

/**
 * Safe-zone points a ranger has pinged ("everyone here is okay"), plus the
 * route from the incident to each one (`src/store/evacuationPoints.ts`).
 */
export function EvacuationPointMarkers() {
  const points = useEvacuationPointsStore((s) => s.points);
  return (
    <>
      {points.flatMap((point) => {
        const layers = [];
        if (point.route.length > 1) {
          layers.push(
            <Polyline
              key={`${point.id}-route`}
              positions={point.route}
              pathOptions={{ color: "#66df75", weight: 3, dashArray: "6 6", className: "route-flow" }}
            />,
          );
        }
        layers.push(
          <Marker key={`${point.id}-marker`} position={[point.lat, point.lon]} icon={EVAC_POINT_ICON}>
            <Popup>
              <div className="font-mono text-xs flex flex-col gap-1">
                <span className="font-bold text-[#131313]">
                  {point.rangerName} · {point.callsign}
                </span>
                <span>Titik evakuasi aman — seluruh korban dalam kondisi baik.</span>
                <span className="text-[10px] text-zinc-500">
                  {new Date(point.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </Popup>
          </Marker>,
        );
        return layers;
      })}
    </>
  );
}
