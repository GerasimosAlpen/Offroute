import { useEffect } from "preact/hooks";
import { HazardStatusPanel } from "../components/tactical-map/HazardStatusPanel";
import { CommsLogPanel } from "../components/tactical-map/CommsLogPanel";
import { TacticalMapCanvas } from "../components/tactical-map/TacticalMapCanvas";
import { StatusBadges } from "../components/tactical-map/StatusBadges";
import { useFlareStore } from "@/store/flare";

export function TacticalMap() {
  const flareSequence = useFlareStore((s) => s.sequence);

  // Being on this page counts as "seen" — on mount, and again if a new
  // FLARE fires while the operator is already looking at the map.
  useEffect(() => {
    useFlareStore.getState().markSeen();
  }, [flareSequence]);

  return (
    <div className="flex-1 h-full overflow-hidden bg-black flex flex-col gap-6 p-10 font-mono">
      <header className="shrink-0 flex items-end justify-between border-b border-[#444] pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#66df75] animate-pulse" />
            <span className="text-[#ffb2bd] text-sm tracking-[0.7px]">
              SISTEM ONLINE • ENKRIPSI AKTIF
            </span>
          </div>
          <h1 className="font-grotesk font-bold text-4xl text-[#e5e2e1] tracking-[-0.8px] uppercase">
            Pusat Komando
          </h1>
        </div>

        <StatusBadges />
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6">
        <div className="col-span-8 min-h-0">
          <TacticalMapCanvas />
        </div>
        <div className="col-span-4 min-h-0 flex flex-col gap-6">
          <HazardStatusPanel />
          <CommsLogPanel />
        </div>
      </div>
    </div>
  );
}
