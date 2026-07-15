import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-preact";
import type { SearchParams } from "./RouteSearchSequence";

interface SearchHudProps {
  label: string;
  params: SearchParams | null;
  scenarioLog: { label: string; result: string }[];
  progress: number;
}

/** Header strip shown while the route-search cinematic runs: status line, candidate stats, contingency checklist, progress bar. */
export function SearchHud({ label, params, scenarioLog, progress }: SearchHudProps) {
  return (
    <motion.div
      key="searching"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden bg-[#0a0a0a] border-b border-[#66df75]/40"
    >
      <div className="px-4 py-2 flex items-center gap-2">
        <Loader2 size={12} className="animate-spin text-[#66df75] shrink-0" />
        <span className="font-mono text-[10px] font-bold text-[#66df75] uppercase tracking-wide truncate">
          {label}
        </span>
      </div>

      {params && (
        <div className="px-4 pb-2 grid grid-cols-4 gap-2 font-mono text-[9px]">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[#555]">JARAK</span>
            <span className="text-[#e5e2e1] font-bold truncate">{params.distanceKm.toFixed(2)} KM</span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[#555]">WAKTU</span>
            <span className="text-[#e5e2e1] font-bold truncate">{params.timeMin} MNT</span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[#555]">RISIKO</span>
            <span className="text-[#e5e2e1] font-bold truncate">{params.risk}%</span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[#555]">MEDAN</span>
            <span className="text-[#e5e2e1] font-bold truncate">{params.terrain}</span>
          </div>
        </div>
      )}

      {scenarioLog.length > 0 && (
        <div className="px-4 pb-2 flex flex-col gap-1 font-mono text-[9px] max-h-24 overflow-y-auto">
          {scenarioLog.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5"
            >
              <Check size={10} className="text-[#66df75] shrink-0" />
              <span className="text-[#666] truncate">{s.label}</span>
              <span className="text-[#66df75] ml-auto shrink-0 truncate">{s.result}</span>
            </motion.div>
          ))}
        </div>
      )}

      <div className="h-[3px] bg-[#1a1a1a]">
        <motion.div
          className="h-full bg-[#66df75]"
          animate={{ width: `${progress * 100}%` }}
          transition={{ ease: "linear", duration: 0.25 }}
        />
      </div>
    </motion.div>
  );
}
