import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useMessagePinsStore } from "@/store/messagePins";
import { formatRelativeAge } from "@/lib/format";

/** Urgent backup requests read differently from routine status pins. */
function isBackup(text: string) {
  return text.toUpperCase().includes("MINTA BACKUP");
}

function pinIcon(backup: boolean) {
  const color = backup ? "#ff0040" : "#5fb3b3";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:20px;height:20px;transform:translate(-50%,-100%);display:flex;align-items:center;justify-content:center;">
        ${backup ? `<span class="animate-ping" style="position:absolute;inset:-4px;border-radius:9999px;background:${color};opacity:0.5;"></span>` : ""}
        <div style="width:18px;height:18px;border-radius:9999px 9999px 9999px 2px;background:${color};border:2px solid #0a0a0a;transform:rotate(45deg);"></div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

/**
 * Field-unit map pins on radar: routine status reports and — the reason
 * this layer was brought back — **backup requests**. A unit tapping "Minta
 * Backup" drops a pulsing red pin here so HQ can see *where* help is needed,
 * on the map, not just as a line in the Comm Center.
 */
export function MessagePinMarkers() {
  const pins = useMessagePinsStore((s) => s.pins);

  return (
    <>
      {pins.map((pin) => {
        const backup = isBackup(pin.text);
        return (
          <Marker key={pin.id} position={[pin.lat, pin.lon]} icon={pinIcon(backup)}>
            <Popup>
              <div className="font-mono text-xs flex flex-col gap-1 min-w-[180px]">
                <span className={backup ? "font-bold text-[#c00030]" : "font-bold text-[#131313]"}>
                  {backup ? "⚠ MINTA BACKUP" : "Laporan Status"}
                </span>
                <span className="text-[#131313]">{pin.rangerName} ({pin.callsign})</span>
                <span className="text-zinc-600">{pin.text}</span>
                <span className="text-[10px] text-zinc-500">{formatRelativeAge(pin.timestamp)}</span>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
