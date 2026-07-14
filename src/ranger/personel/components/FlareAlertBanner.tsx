import { useEffect, useRef } from "preact/hooks";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Siren } from "lucide-preact";
import { useFlareStore } from "@/store/flare";
import { raiseAlert } from "@/lib/alerts";

/**
 * FLARE is already globally synced (same socket/store radar uses, loaded by
 * `AppInit` regardless of route) — the gap was purely that nothing on the
 * personel side ever *read* it. This is that missing piece: an unmissable
 * banner + alert tone the moment radar declares an emergency, visible across
 * every personel screen, not just one page.
 */
export function FlareAlertBanner() {
  const active = useFlareStore((s) => s.active);
  const sequence = useFlareStore((s) => s.sequence);
  const markSeen = useFlareStore((s) => s.markSeen);
  const [, navigate] = useLocation();

  const lastAlertedSequence = useRef<number | null>(null);
  useEffect(() => {
    if (active && lastAlertedSequence.current !== sequence) {
      lastAlertedSequence.current = sequence;
      raiseAlert("MODE FLARE AKTIF", "Pusat komando mendeteksi keadaan darurat. Periksa Tingkat Bahaya sekarang.");
    }
  }, [active, sequence]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-0 inset-x-0 z-[2000] bg-[#93000a] border-b-2 border-[#ff0040] px-4 py-2.5 flex items-center gap-3"
        >
          <Siren size={18} className="text-white shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold uppercase tracking-wide leading-tight">
              Mode Flare Aktif
            </p>
            <p className="text-[#ffb2bd] text-[11px] leading-tight truncate">
              Keadaan darurat terdeteksi pusat komando — periksa detail sekarang.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              markSeen();
              navigate("/ranger/personel/bahaya");
            }}
            className="shrink-0 bg-white text-[#93000a] text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 active:scale-95 transition-transform"
          >
            Lihat
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
