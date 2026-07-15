import { Route } from "lucide-preact";
import type { HazardData, HazardSeverity } from "@/lib/hazards";
import type { EvacuationPoint } from "@/store/evacuationPoints";
import { metersBetween } from "@/lib/routing";
import { formatDistance } from "@/lib/format";

export interface MarkerInfo {
  id: string;
  name: string;
  status: string;
  distance: string;
  color: string;
  lat: number;
  lon: number;
}

export interface RouteOption {
  label: string;
  icon: typeof Route;
  type: "fastest" | "safest";
  distance: string;
  eta: string;
  coords: [number, number][];
}

const SEVERITY_COLOR: Record<HazardSeverity, string> = {
  critical: "#FF0040",
  warning: "#fabd00",
  info: "#66df75",
};

/**
 * The citizen map draws the same live data every other role works from:
 * confirmed evacuation points (the safe zones radar accepted — where to go)
 * and active incidents (what to stay away from). No mock lists.
 */
export function evacPointsToMarkers(
  points: EvacuationPoint[],
  center: [number, number],
): MarkerInfo[] {
  return points.map((p) => ({
    id: `evac-${p.id}`,
    name: "Titik Evakuasi Aman",
    status: "SIAP",
    distance: formatDistance(metersBetween(center, [p.lat, p.lon])),
    color: "#66df75",
    lat: p.lat,
    lon: p.lon,
  }));
}

export function hazardsToMarkers(
  hazards: HazardData[],
  center: [number, number],
): MarkerInfo[] {
  return hazards.map((h) => {
    const lat = center[0] + h.offset[0];
    const lon = center[1] + h.offset[1];
    return {
      id: h.id,
      name: h.label,
      status: h.severity === "critical" ? "BAHAYA" : "WASPADA",
      distance: formatDistance(metersBetween(center, [lat, lon])),
      color: SEVERITY_COLOR[h.severity],
      lat,
      lon,
    };
  });
}
