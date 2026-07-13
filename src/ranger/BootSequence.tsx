import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { motion, AnimatePresence } from "framer-motion";
import { Radar } from "lucide-preact";
import { useDeviceLocation } from "@/store/location";

/** Substituted with the live device location once resolved. */
const LOC_TOKEN = "{{LOC}}";

type Tone = "banner" | "kernel" | "pending" | "ok" | "warn" | "joke";

interface BootStep {
  /** ms to wait after the previous step before this one starts appearing */
  delay: number;
  text: string;
  tone?: Tone;
  /** if set, `pending` text shows first, then flips to `text` after `settle` ms */
  pending?: string;
  settle?: number;
}

interface BootLine {
  text: string;
  tone: Tone;
  ts: number;
}

const BOOT_SCRIPT: BootStep[] = [
  {
    delay: 150,
    text: `Ranger Command Kernel 6.1.0-ranger (${LOC_TOKEN}) booting...`,
    tone: "banner",
  },
  { delay: 110, text: "Detecting comm hardware... done", tone: "kernel" },
  { delay: 80, text: "Initializing radar subsystem", tone: "kernel" },
  {
    delay: 70,
    text: "ACPI: sector power management enabled",
    tone: "kernel",
  },
  { delay: 90, text: "CPU0: coffee levels nominal", tone: "kernel" },
  {
    delay: 130,
    text: "Duct tape integrity at 94% — monitoring",
    tone: "warn",
  },
  {
    delay: 180,
    pending: "Mounting Tactical Map Cache...",
    text: "Mounted Tactical Map Cache",
    settle: 420,
  },
  {
    delay: 220,
    text: "» Please do not feed the interns near the server rack.",
    tone: "joke",
  },
  {
    delay: 200,
    text: "» Relax — the seismographs don't need jokes to work. Only this screen does.",
    tone: "joke",
  },
  {
    delay: 150,
    pending: "Starting Comm Relay...",
    text: "Reached target Comm Relay",
    settle: 260,
  },
  {
    delay: 100,
    text: "random: crng init done (took the scenic route)",
    tone: "kernel",
  },
  {
    delay: 200,
    text: "» Somewhere a seismograph just twitched. Probably nothing. Probably.",
    tone: "joke",
  },
  {
    delay: 160,
    pending: "Starting Sector Uplink Daemon...",
    text: "Started Sector Uplink Daemon",
    settle: 640,
  },
  {
    delay: 200,
    text: "» Uplink handshake successful. Only had to ask nicely twice.",
    tone: "joke",
  },
  {
    delay: 190,
    text: "» Uptime target: forever. Best effort: also forever.",
    tone: "joke",
  },
  {
    delay: 150,
    text: "Snack reserves below 40% — advise resupply",
    tone: "warn",
  },
  {
    delay: 150,
    pending: "Calibrating Hardware Status Bus...",
    text: "Calibrated Hardware Status Bus",
    settle: 340,
  },
  {
    delay: 100,
    text: "Loaded firmware: raccoon-proof-v3.bin",
    tone: "kernel",
  },
  {
    delay: 200,
    text: "» This part's just for show. The important stuff already works.",
    tone: "joke",
  },
  {
    delay: 200,
    text: "» Running mandatory pre-flight nap check... passed.",
    tone: "joke",
  },
  {
    delay: 150,
    pending: "Starting Ranger Command Shell...",
    text: "Started Ranger Command Shell",
    settle: 240,
  },
  {
    delay: 110,
    text: "systemd: ranger-ops.target reached",
    tone: "kernel",
  },
  {
    delay: 200,
    text: "» Reticulating evacuation splines...",
    tone: "joke",
  },
  {
    delay: 180,
    pending: "Starting Flare Beacon Diagnostics...",
    text: "Flare Beacon Diagnostics nominal",
    settle: 500,
  },
  {
    delay: 100,
    text: "entropy pool: sufficiently chaotic",
    tone: "kernel",
  },
  {
    delay: 200,
    text: "» Asking the map nicely to be accurate this time.",
    tone: "joke",
  },
  {
    delay: 160,
    pending: "Syncing Node Graph...",
    text: "Node Graph synced (12 nodes, 0 lost)",
    settle: 460,
  },
  {
    delay: 140,
    text: "Radar hamster wheel RPM below spec",
    tone: "warn",
  },
  {
    delay: 220,
    text: "» Hamster replaced. Please stand by.",
    tone: "joke",
  },
  {
    delay: 180,
    pending: "Warming up Espresso Subroutine...",
    text: "Espresso Subroutine online",
    settle: 380,
  },
  {
    delay: 120,
    text: "All systems nominal. Mostly.",
    tone: "kernel",
  },
  {
    delay: 220,
    text: "» Jokes aside — sensors armed, comms live, ready when you are.",
    tone: "joke",
  },
];

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
                Ranger OS
              </h1>
              <p className="text-[11px] tracking-[3px] text-[#666] uppercase">
                Sector-07 Boot Sequence
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
                <p className="text-[#FF0040] font-bold">SECTOR-07 ONLINE.</p>
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
