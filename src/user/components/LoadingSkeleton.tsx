import { motion } from "framer-motion";

/**
 * Animated loading placeholder — pulsing skeleton bars for content that
 * hasn't loaded yet. Accepts a `count` prop for repeating rows.
 */
export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 26 }}
          className="flex flex-col gap-2 p-4 bg-[#262626] border border-[#444]"
        >
          <motion.div
            className="h-3 w-3/5 rounded bg-[#353535]"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
          <motion.div
            className="h-2 w-full rounded bg-[#2a2a2a]"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 + 0.1 }}
          />
          <motion.div
            className="h-2 w-4/5 rounded bg-[#2a2a2a]"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 + 0.2 }}
          />
        </motion.div>
      ))}
    </div>
  );
}
