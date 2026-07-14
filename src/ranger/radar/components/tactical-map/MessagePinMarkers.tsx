import { Marker, Popup } from "react-leaflet";
import { useMessagePinsStore } from "@/store/messagePins";
import { MESSAGE_PIN_ICON } from "./mapIcons";

/** Personel status messages, pinned to wherever they were sent from (`src/store/messagePins.ts`). */
export function MessagePinMarkers() {
  const pins = useMessagePinsStore((s) => s.pins);
  return (
    <>
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lon]} icon={MESSAGE_PIN_ICON}>
          <Popup>
            <div className="font-mono text-xs flex flex-col gap-1">
              <span className="font-bold text-[#131313]">
                {pin.rangerName} · {pin.callsign}
              </span>
              <span>{pin.text}</span>
              <span className="text-[10px] text-zinc-500">
                {new Date(pin.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
