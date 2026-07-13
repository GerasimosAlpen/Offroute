import { RadioTower } from "lucide-preact";
import { useBmkgQuake } from "@/store/bmkg";

/** Real, live BMKG earthquake feed — independent of the FLARE drill below it. */
export function BmkgTicker() {
  const { status, quake } = useBmkgQuake();

  return (
    <div className="bg-[#131313]/95 border border-[#444] px-3 py-2 w-[220px] pointer-events-none">
      <div className="flex items-center gap-1.5 mb-1">
        <RadioTower size={11} className="text-[#66df75]" />
        <span className="text-[#66df75] text-[10px] font-mono tracking-[1.5px] uppercase">
          BMKG Live
        </span>
        <span className="size-1.5 rounded-full bg-[#66df75] animate-pulse ml-auto shrink-0" />
      </div>

      {status === "ready" && quake && (
        <div className="font-mono text-[11px] leading-4 text-[#e1bec2]">
          <span className="text-[#ff0040] font-bold">M{quake.magnitude.toFixed(1)}</span>{" "}
          <span>· {quake.depthKm}km · {quake.timeWIB}</span>
          <p className="text-[#8a8a8a] mt-0.5 truncate">{quake.region}</p>
        </div>
      )}

      {status === "loading" && (
        <p className="font-mono text-[11px] text-[#666]">Memuat data BMKG...</p>
      )}

      {status === "unavailable" && (
        <p className="font-mono text-[11px] text-[#666]">Data BMKG tidak tersedia.</p>
      )}
    </div>
  );
}
