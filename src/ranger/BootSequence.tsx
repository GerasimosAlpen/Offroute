import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { motion, AnimatePresence } from "framer-motion";

const BOOT_LOG = [
  "Started Sector Uplink Daemon",
  "Mounted Tactical Map Cache",
  "Reached target Comm Relay",
  "Calibrated Hardware Status Bus",
  "Started Ranger Command Shell",
];

const LINE_DELAY_MS = 140;
const HOLD_MS = 300;

// Only play once per app session, not on every route change.
let hasBooted = false;

export function BootSequence({ children }: { children: ComponentChildren }) {
  const [done, setDone] = useState(hasBooted);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    if (hasBooted) return;

    if (lineCount > BOOT_LOG.length) {
      const t = setTimeout(() => {
        hasBooted = true;
        setDone(true);
      }, HOLD_MS);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setLineCount((n) => n + 1), LINE_DELAY_MS);
    return () => clearTimeout(t);
  }, [lineCount]);

  return (
    <>
      <AnimatePresence>
        {!done && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 bg-black text-[#3ddc59] font-mono text-sm p-8 flex flex-col justify-start overflow-hidden"
          >
            {BOOT_LOG.slice(0, lineCount).map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="leading-7"
              >
                <span className="text-[#3ddc59]">[  OK  ]</span>{" "}
                <span className="text-[#c9c9c9]">{line}</span>
              </motion.p>
            ))}
            {lineCount > BOOT_LOG.length && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="leading-7 mt-2 text-[#FF0040] font-bold tracking-[0.5px]"
              >
                SECTOR-07 ONLINE.
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {done && children}
    </>
  );
}
