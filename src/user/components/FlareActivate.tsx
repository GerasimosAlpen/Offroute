import { useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert, X } from "lucide-preact";
import { useFlareStore } from "@/store/flare";

/**
 * Citizens' FLARE activation button — a pulsing red emergency trigger.
 * When active, shows a dismissible status banner. Syncs with the global
 * FLARE store so radar knows when a citizen declares a major incident.
 */
export function FlareActivate() {
  const { active, sequence, trigger } = useFlareStore();
  const [dismissed, setDismissed] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleTrigger = () => {
    setShaking(true);
    trigger();
    setTimeout(() => setShaking(false), 500);
  };

  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        onClick={handleTrigger}
        whileTap={{ scale: 0.95 }}
        animate={
          shaking
            ? { x: [0, -4, 4, -3, 3, -1, 1, 0] }
            : active
              ? { scale: [1, 1.04, 1], boxShadow: [
                  "0 0 0 0 rgba(255,0,64,0.5)",
                  "0 0 0 12px rgba(255,0,64,0)",
                  "0 0 0 0 rgba(255,0,64,0.5)",
                ] }
              : { scale: 1 }
        }
        transition={
          active && !shaking
            ? { scale: { duration: 1.2, repeat: Infinity }, boxShadow: { duration: 1.6, repeat: Infinity } }
            : shaking
              ? { duration: 0.08 }
              : { duration: 0.2 }
        }
        className={`relative w-full font-mono font-bold text-sm tracking-[1px] uppercase flex items-center justify-center gap-2 py-4 transition-colors ${
          active
            ? "bg-[#FF0040] text-[#131313] border-2 border-[#ff2659]"
            : "bg-[#131313] text-[#FF0040] border-2 border-[#FF0040] hover:bg-[#FF0040]/10"
        }`}
      >
        <TriangleAlert size={20} strokeWidth={2.4} />
        <span>{active ? "FLARE AKTIF" : "AKTIFKAN FLARE"}</span>
      </motion.button>

      <AnimatePresence>
        {active && !dismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#93000a]/20 border-l-4 border-[#FF0040] p-3 flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs font-bold text-[#FF0040] tracking-[1px] uppercase">
                  Keadaan Darurat Terdeteksi
                </span>
                <span className="font-mono text-[10px] text-[#e1bec2]">
                  Sinyal FLARE telah dikirim ke pusat komando. Tim terdekat akan segera dihubungi.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="shrink-0 text-[#666] hover:text-[#e5e2e1]"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="font-mono text-[9px] text-[#666] tracking-wider text-center uppercase">
        {active ? `Sinyal #${sequence} — Tim sedang menuju lokasi Anda` : "Tekan untuk keadaan darurat"}
      </div>
    </div>
  );
}
