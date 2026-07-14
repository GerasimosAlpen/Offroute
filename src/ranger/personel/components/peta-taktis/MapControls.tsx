import { useMap } from "react-leaflet";
import { LocateFixed } from "lucide-preact";

export function MapControls({ userPos }: { userPos: [number, number] | null }) {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-3 z-[1000] flex flex-col gap-2">
      <button
        type="button"
        onClick={() => userPos && map.setView(userPos, 15)}
        className="size-10 flex items-center justify-center text-[#e5e2e1] hover:text-[#ffb2bd] transition-colors bg-[#1a1a1a]/95 backdrop-blur-sm border border-[#444] active:bg-[#2a2a2a]"
      >
        <LocateFixed size={16} />
      </button>
    </div>
  );
}
