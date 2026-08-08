import { useLocation } from "wouter";
import { TriangleAlert, X } from "lucide-preact";
import { motion, AnimatePresence } from "framer-motion";
import { useFlareStore } from "@/store/flare";

const MAP_PATH = "/ranger/radar/map";

/**
 * Cross-page nudge: if a FLARE is active and the operator isn't looking at
 * the tactical map, let them know — but never force it. "Abaikan" just marks
 * it seen and gets out of the way, same as clicking into the map would.
 */
export function EmergencyNotice() {
  const { active, seen } = useFlareStore();
  const markSeen = useFlareStore((s) => s.markSeen);
  const [location, navigate] = useLocation();

  const shouldShow = active && !seen && location !== MAP_PATH;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-[2000] bg-[#131313] border border-[#ff0040] px-4 py-3 flex items-center gap-3 shadow-[0_0_20px_rgba(255,0,64,0.3)] max-w-sm"
        >
          <TriangleAlert size={18} className="text-[#ff0040] shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-mono text-xs font-bold text-[#ff0040] tracking-[1px] uppercase">
              Keadaan Darurat Terdeteksi
            </span>
            <span className="font-mono text-[11px] text-[#8a8a8a]">
              Tactical Map perlu perhatian Anda.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(MAP_PATH)}
            className="shrink-0 font-mono text-[11px] font-bold text-[#131313] bg-[#ff0040] hover:bg-[#ff2659] px-2.5 py-1.5 uppercase"
          >
            Lihat
          </button>
          <button
            type="button"
            onClick={markSeen}
            aria-label="Abaikan"
            className="shrink-0 text-[#666] hover:text-[#e5e2e1]"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
