import { useEffect, useState } from "preact/hooks";
import { type FlareProgress } from "./FlareSequence";

export function OpsHud({ magnitude, progress }: { magnitude: number; progress: FlareProgress }) {
  const [displayMag, setDisplayMag] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setDisplayMag(magnitude * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [magnitude]);

  const etaLabel =
    progress.etaMs !== null
      ? `${String(Math.floor(progress.etaMs / 60_000)).padStart(2, "0")}:${String(
          Math.floor((progress.etaMs % 60_000) / 1000),
        ).padStart(2, "0")}`
      : "—:—";

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-[#131313]/95 border border-[#ff0040]/60 px-3 py-2 flex flex-col gap-1 font-mono pointer-events-none min-w-[150px]">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] text-[#8a8a8a] tracking-[1.5px] uppercase">Magnitudo</span>
        <span className="text-[#ff0040] font-bold text-sm">{displayMag.toFixed(1)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] text-[#8a8a8a] tracking-[1.5px] uppercase">Unit Dikirim</span>
        <span className="text-[#e5e2e1] text-sm">
          {progress.unitsDispatched}/{progress.totalUnits}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] text-[#8a8a8a] tracking-[1.5px] uppercase">ETA</span>
        <span className="text-[#5fb3b3] text-sm">{etaLabel}</span>
      </div>
    </div>
  );
}
