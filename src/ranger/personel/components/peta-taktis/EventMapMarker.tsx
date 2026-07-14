import { Marker } from "react-leaflet";
import { buildEventIcon } from "./mapIcons";
import type { EventMarker } from "./types";

export function EventMapMarker({
  event,
  onSelect,
}: {
  event: EventMarker;
  onSelect: (e: EventMarker) => void;
}) {
  const icon = buildEventIcon(event);
  return (
    <Marker
      position={event.pos}
      icon={icon}
      eventHandlers={{ click: () => onSelect(event) }}
    />
  );
}
