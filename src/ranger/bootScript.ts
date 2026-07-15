/** Substituted with the live device location once resolved. */
export const LOC_TOKEN = "{{LOC}}";

export type Tone = "banner" | "kernel" | "pending" | "ok" | "warn" | "joke";

export interface BootStep {
  /** ms to wait after the previous step before this one starts appearing */
  delay: number;
  text: string;
  tone?: Tone;
  /** if set, `pending` text shows first, then flips to `text` after `settle` ms */
  pending?: string;
  settle?: number;
}

/**
 * The fake kernel-style boot log BootSequence.tsx plays on first load —
 * pure theater data, kept out of the component so tweaking a line doesn't
 * mean scrolling past the animation machinery (and vice versa).
 */
export const BOOT_SCRIPT: BootStep[] = [
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
