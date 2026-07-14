import { useMap } from "react-leaflet";
import { Plus, Minus, LocateFixed } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";

export function MapControls({ coords }: { coords: { lat: number; lon: number } }) {
  const map = useMap();

  const buttons: { icon: LucideIcon; onClick: () => void }[] = [
    { icon: Plus, onClick: () => map.zoomIn() },
    { icon: Minus, onClick: () => map.zoomOut() },
    { icon: LocateFixed, onClick: () => map.setView([coords.lat, coords.lon], 15) },
  ];

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
      {buttons.map(({ icon: Icon, onClick }, i) => (
        <button
          key={i}
          type="button"
          onClick={onClick}
          className="size-10 flex items-center justify-center bg-[#262626] border border-[#444] text-[#e5e2e1] hover:border-[#FF0040]/60"
        >
          <Icon size={16} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
