import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { motion, AnimatePresence } from "framer-motion";
import { Radar } from "lucide-preact";
import { useDeviceLocation } from "@/store/location";
import { BOOT_SCRIPT, LOC_TOKEN, type Tone } from "./bootScript";

interface BootLine {
  text: string;
  tone: Tone;
  ts: number;
}

const HOLD_MS = 600;
const FINAL_DELAY_MS = 260;

function formatTimestamp(ms: number) {
  return `[${(ms / 1000).toFixed(6).padStart(11, " ")}]`;
}

function toneClass(tone: Tone) {
  switch (tone) {
    case "banner":
      return "text-[#e8e8e8]";
    case "kernel":
      return "text-[#8a8a8a]";
    case "pending":
      return "text-[#d4c05a]";
    case "ok":
      return "text-[#3ddc59]";
    case "warn":
      return "text-[#e0b03d]";
    case "joke":
      return "text-[#5fb3b3] italic";
  }
}

function BootLineRow({ line }: { line: BootLine }) {
  return (
    <p className="leading-5 whitespace-pre-wrap break-all">
      {line.tone !== "banner" && line.tone !== "joke" && (
        <span className="text-[#3a5a44]">{formatTimestamp(line.ts)} </span>
      )}
      {line.tone === "ok" && <span className={toneClass("ok")}>[  OK  ] </span>}
      {line.tone === "warn" && (
        <span className={toneClass("warn")}>[ WARN ] </span>
      )}
      <span className={line.tone === "ok" || line.tone === "warn" ? "text-[#7a7a7a]" : toneClass(line.tone)}>
        {line.text}
      </span>
    </p>
  );
}

function RadarLogo({ spinning }: { spinning: boolean }) {
  return (
    <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border border-[#FF0040]/40"
          animate={
            spinning
              ? { scale: [1, 1.9], opacity: [0.55, 0] }
              : { scale: 1, opacity: 0 }
          }
          transition={{
            duration: 2.2,
            repeat: Infinity,
            delay: i * 0.7,
            ease: "easeOut",
          }}
        />
      ))}
      <div className="absolute inset-0 rounded-full border-2 border-[#FF0040]/25" />
      <motion.div
        className="absolute inset-2 rounded-full overflow-hidden"
        animate={spinning ? { rotate: 360 } : {}}
        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="w-1/2 h-full ml-auto"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(255,0,64,0.9) 26deg, transparent 60deg)",
          }}
        />
      </motion.div>
      <Radar
        size={36}
        strokeWidth={1.6}
        className="relative z-10 text-[#FF0040]"
      />
    </div>
  );
}

// Only play once per app session, not on every route change.
let hasBooted = false;

export function BootSequence({ children }: { children: ComponentChildren }) {
  const [done, setDone] = useState(hasBooted);
  const [lines, setLines] = useState<BootLine[]>([]);
  const [final, setFinal] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const location = useDeviceLocation();
  const sectorTag =
    location.status === "ready" ||
    location.status === "resolving" ||
    location.status === "cached"
      ? location.label
      : "SECTOR UNKNOWN";
  const sectorTagRef = useRef(sectorTag);
  sectorTagRef.current = sectorTag;

  useEffect(() => {
    if (hasBooted) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const resolve = (text: string) =>
      text.replace(LOC_TOKEN, sectorTagRef.current);

    async function run() {
      let elapsed = 0;

      for (const step of BOOT_SCRIPT) {
        await wait(step.delay);
        if (cancelled) return;
        elapsed += step.delay;

        if (step.pending) {
          setLines((prev) => [
            ...prev,
            { text: resolve(step.pending!), tone: "pending", ts: elapsed },
          ]);
          await wait(step.settle ?? 200);
          if (cancelled) return;
          elapsed += step.settle ?? 200;
          setLines((prev) => [
            ...prev.slice(0, -1),
            { text: resolve(step.text), tone: "ok", ts: elapsed },
          ]);
        } else {
          setLines((prev) => [
            ...prev,
            { text: resolve(step.text), tone: step.tone ?? "ok", ts: elapsed },
          ]);
        }
      }

      await wait(FINAL_DELAY_MS);
      if (cancelled) return;
      setFinal(true);

      await wait(HOLD_MS);
      if (cancelled) return;
      hasBooted = true;
      setDone(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [lines, final]);

  const progress = final
    ? 100
    : Math.min(97, Math.round((lines.length / BOOT_SCRIPT.length) * 100));

  const current = final
    ? { text: `${sectorTag} ONLINE.`, tone: "ok" as Tone }
    : lines[lines.length - 1];

  return (
    <>
      <AnimatePresence>
        {!done && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col items-center justify-center gap-6 font-mono"
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.05]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, #fff 0px, #fff 1px, transparent 1px, transparent 3px)",
              }}
            />

            <RadarLogo spinning={!final} />

            <div className="flex flex-col items-center gap-1">
              <h1 className="font-grotesk font-bold text-2xl tracking-[-0.4px] text-[#FF0040] uppercase">
                Offroute
              </h1>
              <p className="text-[11px] tracking-[3px] text-[#666] uppercase">
                Field Unit System
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 w-72">
              <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#FF0040]"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
              </div>
              <div className="flex items-center justify-between w-full text-[10px] tracking-[2px] text-[#555] uppercase">
                <span>Boot</span>
                <span>{progress}%</span>
              </div>
            </div>

            <div className="h-5 flex items-center justify-center px-6 max-w-md text-center">
              <AnimatePresence mode="wait">
                {current && (
                  <motion.p
                    key={final ? "final" : lines.length}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className={`text-xs tracking-wide truncate ${
                      final
                        ? "text-[#FF0040] font-bold"
                        : toneClass(current.tone)
                    }`}
                  >
                    {current.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div
              className="absolute bottom-0 inset-x-0 h-28 overflow-y-auto px-8 pb-4 pt-8 text-[10px] opacity-40"
              style={{
                maskImage: "linear-gradient(to bottom, transparent, black 28px)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent, black 28px)",
              }}
            >
              {lines.map((line, i) => (
                <BootLineRow key={i} line={line} />
              ))}
              {final && (
                <p className="text-[#FF0040] font-bold">{sectorTag} ONLINE.</p>
              )}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {done && children}
    </>
  );
}
