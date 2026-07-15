import type { HazardData, HazardKind, HazardSeverity } from "@/lib/hazards";
import { metersBetween } from "@/lib/routing";
import { formatDistance } from "@/lib/format";
import type { EventMarker } from "./types";

const KIND_TO_TYPE: Record<HazardKind, EventMarker["type"]> = {
  fire: "KEBAKARAN",
  blocked: "BENCANA",
  medical: "MEDIS",
  crash: "KEAMANAN",
  theft: "KEAMANAN",
};

const SEVERITY_TO_DANGER: Record<HazardSeverity, EventMarker["danger"]> = {
  critical: "KRITIS",
  warning: "TINGGI",
  info: "SEDANG",
};

/**
 * Adapts the live shared incident feed (`useIncidents()` — the same data
 * radar's tactical map and Status Taktis render) into the personel map's
 * marker shape. Positions anchor to the crew's captured *starting* point
 * plus each incident's viewer-relative offset (see src/lib/hazards.ts) —
 * hazards must not drift as the crew walks.
 */
export function hazardsToEventMarkers(
  hazards: HazardData[],
  anchorPos: [number, number],
): EventMarker[] {
  return hazards.map((h) => {
    const pos: [number, number] = [anchorPos[0] + h.offset[0], anchorPos[1] + h.offset[1]];
    return {
      id: h.id,
      name: h.label,
      type: KIND_TO_TYPE[h.kind],
      danger: SEVERITY_TO_DANGER[h.severity],
      label: h.label,
      pos,
      distance: formatDistance(metersBetween(anchorPos, pos)),
    };
  });
}
