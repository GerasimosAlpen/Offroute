import { motion, AnimatePresence } from "framer-motion";
import { useWindowLayout } from "./useWindowLayout";

/** Windows-Snap-style translucent preview, shown over the desktop while a window drag is near an edge/corner. */
export function SnapOverlay() {
  const zone = useWindowLayout((s) => s.dragSnapZone);

  return (
    <AnimatePresence>
      {zone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute pointer-events-none z-[9999] bg-[#5fb3b3]/20 border-2 border-[#5fb3b3]"
          style={{
            left: `${zone.x * 100}%`,
            top: `${zone.y * 100}%`,
            width: `${zone.w * 100}%`,
            height: `${zone.h * 100}%`,
          }}
        />
      )}
    </AnimatePresence>
  );
}
