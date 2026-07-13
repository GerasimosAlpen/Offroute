import { motion, AnimatePresence } from "framer-motion";

/** Floating label shown next to a collapsed icon-only sidebar control. */
export function SidebarTooltip({
  show,
  label,
}: {
  show: boolean;
  label: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.12 }}
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded bg-[#1a1a1a] border border-[#444] text-[#e1bec2] text-xs font-mono whitespace-nowrap z-50 pointer-events-none"
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
