import { motion } from "framer-motion";

/** A ring of shock expanding from screen-center across the whole map — one ping isn't enough. */
export function ShockwaveRing({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0.85 }}
      animate={{ scale: 7, opacity: 0 }}
      transition={{ duration: 1.6, delay, ease: "easeOut" }}
      className="absolute top-1/2 left-1/2 z-[850] pointer-events-none rounded-full border-4 border-[#ff0040]"
      style={{ width: 100, height: 100, marginLeft: -50, marginTop: -50 }}
    />
  );
}
