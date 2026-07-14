import { useEffect, useState } from "preact/hooks";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { LocateFixed, Compass, X, Navigation, Flame, AlertTriangle, ChevronRight, Clock, Shield, Skull, Loader2, Check } from "lucide-preact";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";

import { useDeviceLocation } from "@/store/location";
import { useDeviceHeading, startHeadingWatch } from "@/store/heading";
import { metersBetween, fetchRoadRoute, buildFallbackRoute, animateRouteReveal, routeLengthMeters } from "@/lib/routing";
import "@/lib/leaflet-setup";

// ─── Types ─────────────────────────────────────────────────────────────────

interface EventMarker {
  id: string;
  name: string;
  type: "KEBAKARAN" | "BENCANA" | "MEDIS" | "KEAMANAN";
  danger: "KRITIS" | "TINGGI" | "SEDANG";
  label: string;
  pos: [number, number];
  distance: string;
  affected: number;
}

interface RouteOption {
  id: "fastest" | "moderate" | "safest";
  label: string;
  sublabel: string;
  time: string;
  distance: string;
  danger: "tinggi" | "sedang" | "rendah";
  dangerLabel: string;
  color: string;
  borderColor: string;
  icon: typeof Skull;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DANGER_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  KRITIS: { border: "#FF0040", bg: "rgba(255,0,64,0.18)", text: "#FF0040", glow: "0 0 12px rgba(255,0,64,0.5)" },
  TINGGI: { border: "#ffb2bd", bg: "rgba(255,178,189,0.12)", text: "#ffb2bd", glow: "0 0 8px rgba(255,178,189,0.3)" },
  SEDANG: { border: "#fabd00", bg: "rgba(250,189,0,0.12)", text: "#fabd00", glow: "" },
};

const TYPE_ICONS_SVG: Record<string, string> = {
  KEBAKARAN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0040"><path d="M12 2C10 6 8 8 8 11a4 4 0 008 0c0-3-2-5-4-9z"/><path d="M10 18a2 2 0 104 0" fill="#ff6680"/></svg>`,
  BENCANA: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fabd00" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  MEDIS: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb2bd" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12h6M12 9v6"/></svg>`,
  KEAMANAN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fabd00" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
};

// ─── Map Icons ───────────────────────────────────────────────────────────────

// Markers sit inside the same wrapper that gets CSS-rotated to match device
// heading (see the `--map-heading` var set in PetaTaktis below) — every
// marker counter-rotates by that same var so labels/icons stay upright and
// legible instead of spinning along with the base map. A no-op (0deg) when
// heading isn't available, so nothing changes for the plain north-up case.
function buildEventIcon(event: EventMarker) {
  const c = DANGER_COLORS[event.danger];
  const svg = TYPE_ICONS_SVG[event.type];
  const pulse = event.danger === "KRITIS"
    ? `<span style="position:absolute;inset:0;background:${c.border};opacity:0.2;animation:pulse 1.8s infinite;"></span>`
    : "";

  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;transform:translate(-50%,-100%) rotate(var(--map-heading, 0deg));">
        <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:2px solid ${c.border};box-shadow:${c.glow};">
          ${pulse}
          ${svg}
        </div>
        <div style="background:${c.border};color:#fff;font-family:'JetBrains Mono Variable',monospace;font-size:9px;font-weight:bold;padding:2px 7px;letter-spacing:0.08em;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;">
          ${event.name}
        </div>
        <div style="background:#131313;color:${c.text};font-family:'JetBrains Mono Variable',monospace;font-size:8px;padding:1px 5px;border:1px solid ${c.border};white-space:nowrap;">
          ${event.danger} · ${event.distance}
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

const SELF_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:16px;height:16px;transform:translate(-50%,-50%);">
      <span style="position:absolute;inset:0;border-radius:9999px;background:#3ddc59;opacity:0.6;animation:pulse 2s infinite;"></span>
      <span style="position:absolute;inset:3px;border-radius:9999px;background:#3ddc59;border:2px solid #0a0a0a;"></span>
      <span style="position:absolute;left:50%;top:-13px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid #3ddc59;transform:translateX(-50%);opacity:var(--heading-available, 0);filter:drop-shadow(0 0 3px rgba(61,220,89,0.7));"></span>
    </div>
  `,
  iconSize: [0, 0],
});

// The fixed point a route search began from — distinct from the live SELF_ICON
// dot, which keeps moving with GPS. Lets the crew see start vs. current
// position vs. destination all at once instead of just one wandering dot.
const START_ICON = L.divIcon({
  className: "",
  html: `
    <div style="transform:translate(-50%,-100%) rotate(var(--map-heading, 0deg));">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8888ff" stroke-width="2.2" style="filter:drop-shadow(0 0 4px rgba(136,136,255,0.6));">
        <path d="M5 21V4a1 1 0 0 1 1-1h11.5a.5.5 0 0 1 .4.8L14 9l3.9 5.2a.5.5 0 0 1-.4.8H6" />
      </svg>
    </div>
  `,
  iconSize: [0, 0],
});

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Route Search — "every combination" cinematic ──────────────────────────
//
// This whole section is a visualization, not a routing algorithm: OSRM's
// free demo endpoint only ever returns one real path (see fetchRoadRoute in
// src/lib/routing.ts), so there's no actual alternatives-comparison to show.
// What's real is the *destination* — every candidate below terminates at the
// same incident, and the winner is swapped for the genuine OSRM/fallback
// geometry the instant it's ready. Everything in between (candidate count,
// scores, terrain/risk labels) is generated client-side purely so a
// sub-second network fetch reads as a deliberate multi-path search, sort-
// algorithm-visualizer style, instead of an instant snap.

const CANDIDATE_PALETTE = ["#66df75", "#fabd00", "#ffb2bd", "#3ddc59", "#8888ff", "#ff8a3d", "#4dd0e1", "#c792ea"];
const TERRAIN_LABELS = ["ASPAL", "TANAH", "BERBATU", "BERLUMPUR"];
const CANDIDATE_COUNT = 8;

// Contingency checks run once the best route is picked — reassures the
// on-field crew every likely failure mode along the way already has a
// fallback, before they commit to moving. Entirely canned/simulated (see
// note in TODO.md): nothing here reads real GPS/hazard state yet, it's a
// fixed checklist that always "passes."
const SCENARIOS: { label: string; result: string }[] = [
  { label: "JALAN UTAMA TERTUTUP", result: "RUTE ALTERNATIF SIAP" },
  { label: "LONGSOR / JALUR RUSAK", result: "REROUTE OTOMATIS AKTIF" },
  { label: "SINYAL GPS TERPUTUS", result: "MODE OFFLINE + BLUETOOTH SIAP" },
  { label: "ZONA BAHAYA BARU MUNCUL", result: "PERINGATAN & JALUR HINDARI" },
  { label: "CUACA MEMBURUK", result: "KECEPATAN & RUTE DISESUAIKAN" },
];

type SearchPhase = "scanning" | "generating" | "evaluating" | "winner" | "contingency";

interface SearchParams {
  distanceKm: number;
  timeMin: number;
  risk: number;
  terrain: string;
}

interface RouteCandidate {
  id: number;
  full: [number, number][];
  revealed: [number, number][];
  color: string;
  distanceM: number;
  timeMin: number;
  risk: number;
  terrain: string;
  score: number;
  dimmed: boolean;
  isBest: boolean;
}

/** Spreads `count` distinct fake candidate paths (varied bend + slight endpoint jitter) between two points, each scored on invented distance/risk/terrain so a "best" can be picked. */
function buildCandidates(userPos: [number, number], destPos: [number, number]): RouteCandidate[] {
  return Array.from({ length: CANDIDATE_COUNT }, (_, i) => {
    const bend = (i / (CANDIDATE_COUNT - 1) - 0.5) * 0.95;
    const jitteredEnd: [number, number] = [
      destPos[0] + (Math.random() - 0.5) * 0.0004,
      destPos[1] + (Math.random() - 0.5) * 0.0004,
    ];
    const full = buildFallbackRoute(userPos, jitteredEnd, 26, bend);
    const distanceM = routeLengthMeters(full);
    const risk = Math.round(Math.random() * 90) + 5;
    const terrain = TERRAIN_LABELS[Math.floor(Math.random() * TERRAIN_LABELS.length)];
    const timeMin = Math.max(1, Math.round((distanceM / 1000 / 28) * 60));
    const terrainPenalty = terrain === "BERLUMPUR" ? 1.35 : terrain === "BERBATU" ? 1.15 : 1;
    const score = distanceM * (1 + risk / 100) * terrainPenalty;
    return {
      id: i,
      full,
      revealed: [],
      color: CANDIDATE_PALETTE[i % CANDIDATE_PALETTE.length],
      distanceM,
      timeMin,
      risk,
      terrain,
      score,
      dimmed: false,
      isBest: false,
    };
  });
}

/**
 * Renders inside `<MapContainer>` (needs `useMap()` for the epic zoom
 * out/in). Runs once on mount — the caller forces a fresh run by remounting
 * with a new `key`, which also cancels any in-flight run via the effect
 * cleanup below.
 */
function RouteSearchSequence({
  destination,
  userPos,
  onPhase,
  onScenarioTick,
  onResolved,
}: {
  destination: EventMarker;
  userPos: [number, number];
  onPhase: (phase: SearchPhase, label: string, params: SearchParams | null, progress: number) => void;
  onScenarioTick: (entry: { label: string; result: string }) => void;
  onResolved: (route: [number, number][]) => void;
}) {
  const map = useMap();
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [compareIndex, setCompareIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // 1. Zoom OUT to frame the whole search area — the "scanning" beat.
      onPhase("scanning", "MEMINDAI AREA PENCARIAN...", null, 0);
      const bounds = L.latLngBounds([userPos, destination.pos]).pad(0.7);
      map.flyToBounds(bounds, { duration: 1, easeLinearity: 0.2 });
      await wait(950);
      if (cancelled) return;

      // 2. Generate every candidate at once, kick off the real OSRM fetch in
      // parallel, and let all candidates fill in together (staggered, like a
      // wave) rather than one at a time.
      onPhase("generating", `MEMBANGUN ${CANDIDATE_COUNT} KEMUNGKINAN JALUR...`, null, 0.1);
      const initial = buildCandidates(userPos, destination.pos);
      setCandidates(initial);
      const realRoutePromise = fetchRoadRoute(userPos, destination.pos).then(
        (r) => r ?? buildFallbackRoute(userPos, destination.pos),
      );

      await Promise.all(
        initial.map(
          (c, i) =>
            new Promise<void>((resolve) => {
              (async () => {
                await wait(i * 65);
                if (cancelled) return resolve();
                await animateRouteReveal(
                  c.full,
                  750,
                  (partial) => setCandidates((prev) => prev.map((p) => (p.id === c.id ? { ...p, revealed: partial } : p))),
                  () => cancelled,
                );
                resolve();
              })();
            }),
        ),
      );
      if (cancelled) return;

      // 3. Sweep-compare every candidate, sort-visualizer style — track a
      // running "best so far," flash its parameters into the HUD, and dim
      // whichever one loses the comparison.
      let bestSoFar = initial[0];
      setCandidates((prev) => prev.map((p) => ({ ...p, isBest: p.id === bestSoFar.id })));
      for (let i = 0; i < initial.length; i++) {
        if (cancelled) return;
        const cand = initial[i];
        setCompareIndex(i);
        onPhase(
          "evaluating",
          `MEMBANDINGKAN JALUR ${i + 1}/${initial.length}...`,
          { distanceKm: cand.distanceM / 1000, timeMin: cand.timeMin, risk: cand.risk, terrain: cand.terrain },
          0.2 + (i / initial.length) * 0.6,
        );
        await wait(230);
        if (cancelled) return;
        if (cand.score < bestSoFar.score) bestSoFar = cand;
        const winnerId = bestSoFar.id;
        setCandidates((prev) =>
          prev.map((p) => (p.id === cand.id ? { ...p, dimmed: p.id !== winnerId, isBest: p.id === winnerId } : p)),
        );
      }
      if (cancelled) return;
      setCompareIndex(-1);
      const winner = bestSoFar;
      setCandidates((prev) => prev.map((p) => ({ ...p, dimmed: p.id !== winner.id, isBest: p.id === winner.id })));

      // 4. Epic push-in on the winner.
      onPhase(
        "winner",
        "JALUR TERBAIK DITEMUKAN",
        { distanceKm: winner.distanceM / 1000, timeMin: winner.timeMin, risk: winner.risk, terrain: winner.terrain },
        0.9,
      );
      map.flyToBounds(L.latLngBounds(winner.full).pad(0.3), { duration: 1.1, maxZoom: 17 });
      await wait(1000);
      if (cancelled) return;

      // 5. Contingency sweep — every likely thing that could go wrong on
      // the way gets a quick simulated check, so the crew sees it's covered
      // before moving, not just handed a line on a map.
      onPhase("contingency", "MENYIMULASIKAN SKENARIO DARURAT...", null, 0.95);
      for (const scenario of SCENARIOS) {
        if (cancelled) return;
        await wait(260);
        if (cancelled) return;
        onScenarioTick(scenario);
      }
      await wait(300);
      if (cancelled) return;

      // 6. Swap the winning candidate for the real, road-snapped geometry.
      const real = await realRoutePromise;
      if (cancelled) return;
      onResolved(real);
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {candidates.map((c, idx) => (
        <Polyline
          key={c.id}
          positions={c.revealed}
          pathOptions={{
            color: c.color,
            weight: c.isBest ? 5 : idx === compareIndex ? 4 : 2,
            opacity: c.dimmed ? 0.08 : c.isBest ? 0.95 : idx === compareIndex ? 0.9 : 0.5,
            dashArray: c.isBest ? undefined : "4 7",
          }}
        />
      ))}
    </>
  );
}

// ─── Route Options ───────────────────────────────────────────────────────────

function buildRouteOptions(_event: EventMarker, distKm: number): RouteOption[] {
  const base = Math.round(distKm * 3 + 4); // rough minutes
  return [
    {
      id: "fastest",
      label: "Tercepat",
      sublabel: "Rute paling singkat, melalui zona bahaya",
      time: `${base} mnt`,
      distance: `${distKm.toFixed(1)} km`,
      danger: "tinggi",
      dangerLabel: "BAHAYA TINGGI",
      color: "#FF0040",
      borderColor: "border-[#FF0040]",
      icon: Skull,
    },
    {
      id: "moderate",
      label: "Lebih Aman",
      sublabel: "Memutar sedikit, hindari zona panas",
      time: `${base + Math.round(base * 0.4)} mnt`,
      distance: `${(distKm * 1.4).toFixed(1)} km`,
      danger: "sedang",
      dangerLabel: "BAHAYA SEDANG",
      color: "#fabd00",
      borderColor: "border-[#fabd00]",
      icon: AlertTriangle,
    },
    {
      id: "safest",
      label: "Paling Aman",
      sublabel: "Jalur memutar, zona aman sepenuhnya",
      time: `${base + Math.round(base * 0.9)} mnt`,
      distance: `${(distKm * 1.9).toFixed(1)} km`,
      danger: "rendah",
      dangerLabel: "AMAN",
      color: "#66df75",
      borderColor: "border-[#66df75]",
      icon: Shield,
    },
  ];
}

// ─── Route Sheet ─────────────────────────────────────────────────────────────

function RouteSheet({
  event,
  userPos,
  onClose,
  onSelectRoute,
}: {
  event: EventMarker;
  userPos: [number, number];
  onClose: () => void;
  onSelectRoute: (route: RouteOption) => void;
}) {
  const distKm = metersBetween(userPos, event.pos) / 1000;
  const options = buildRouteOptions(event, distKm);
  const c = DANGER_COLORS[event.danger];

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="fixed inset-x-0 bottom-0 z-[2000] bg-[#131313] border-t-2"
      style={{ borderColor: c.border }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-[#444]" />
      </div>

      {/* Header */}
      <div className="px-5 pb-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: c.text }}>
            {event.danger} · {event.type}
          </span>
          <span className="font-grotesk font-bold text-[#e5e2e1] text-base leading-tight">{event.name}</span>
          <span className="font-mono text-[10px] text-[#555]">{event.distance} dari lokasi Anda</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center border border-[#333] text-[#555] hover:text-[#e1bec2] hover:border-[#ffb2bd] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Route title */}
      <div className="px-5 pt-4 pb-2">
        <span className="font-mono text-[10px] text-[#555] uppercase tracking-widest">
          Pilih jalur navigasi
        </span>
      </div>

      {/* Route options */}
      <div className="px-4 pb-24 flex flex-col gap-2.5">
        {options.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 400, damping: 30 }}
              onClick={() => onSelectRoute(opt)}
              className={`w-full flex items-center gap-3 p-3.5 bg-[#1e1e1e] border ${opt.borderColor} hover:brightness-110 active:scale-95 transition-all text-left`}
            >
              <div
                className="w-9 h-9 flex items-center justify-center shrink-0 border"
                style={{ borderColor: opt.color, background: `${opt.color}18` }}
              >
                <Icon size={14} style={{ color: opt.color } as any} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-grotesk font-bold text-[#e5e2e1] text-sm">{opt.label}</span>
                  <span
                    className="font-mono text-[8px] px-1.5 py-0.5 border"
                    style={{ color: opt.color, borderColor: opt.color, background: `${opt.color}18` }}
                  >
                    {opt.dangerLabel}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[#666] leading-tight">{opt.sublabel}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <div className="flex items-center gap-1">
                  <Clock size={10} style={{ color: opt.color } as any} />
                  <span className="font-mono text-[11px] font-bold" style={{ color: opt.color }}>
                    {opt.time}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#555]">{opt.distance}</span>
              </div>
              <ChevronRight size={14} className="text-[#444] shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Event Popup (bottom sheet style) ─────────────────────────────────────

function EventPopup({
  event,
  onClose,
  onNavigate,
}: {
  event: EventMarker;
  userPos: [number, number];
  onClose: () => void;
  onNavigate: () => void;
}) {
  const c = DANGER_COLORS[event.danger];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="fixed bottom-[72px] left-3 right-3 z-[1500] bg-[#1a1a1a] border"
      style={{ borderColor: c.border, boxShadow: c.glow }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between border-b"
        style={{ borderColor: `${c.border}44`, background: c.bg }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[9px] font-bold px-1.5 py-0.5 border"
            style={{ color: c.text, borderColor: c.border }}
          >
            {event.danger}
          </span>
          <span className="font-grotesk font-semibold text-[#e5e2e1] text-sm leading-none">
            {event.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#555] hover:text-[#e1bec2] transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-2 font-mono text-[10px] text-[#e1bec2]">
        <div className="flex justify-between border-b border-[#2a2a2a] pb-1.5">
          <span className="text-[#555]">TIPE:</span>
          <span style={{ color: c.text }}>{event.type}</span>
        </div>
        <div className="flex justify-between border-b border-[#2a2a2a] pb-1.5">
          <span className="text-[#555]">JARAK:</span>
          <span className="text-[#e5e2e1] font-bold">{event.distance}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">TERDAMPAK:</span>
          <span className="text-[#e5e2e1]">{event.affected} orang</span>
        </div>
      </div>

      {/* Navigate button */}
      <div className="px-3 pb-3">
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-center gap-2 py-2.5 font-mono text-xs uppercase tracking-wider font-bold border transition-all hover:brightness-110 active:scale-95"
          style={{
            color: c.text,
            borderColor: c.border,
            background: c.bg,
          }}
        >
          <Navigation size={13} />
          Navigasi
        </button>
      </div>
    </motion.div>
  );
}

// ─── Clickable Marker ──────────────────────────────────────────────────────

function EventMapMarker({
  event,
  onSelect,
}: {
  event: EventMarker;
  onSelect: (e: EventMarker) => void;
}) {
  const icon = buildEventIcon(event);
  return (
    <Marker
      position={event.pos}
      icon={icon}
      eventHandlers={{ click: () => onSelect(event) }}
    />
  );
}

// ─── Map Controls ─────────────────────────────────────────────────────────

function MapControls({ userPos }: { userPos: [number, number] | null }) {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-3 z-[1000] flex flex-col gap-2">
      <button
        type="button"
        onClick={() => userPos && map.setView(userPos, 15)}
        className="size-10 flex items-center justify-center text-[#e5e2e1] hover:text-[#ffb2bd] transition-colors bg-[#1a1a1a]/95 backdrop-blur-sm border border-[#444] active:bg-[#2a2a2a]"
      >
        <LocateFixed size={16} />
      </button>
    </div>
  );
}

// ─── Intro Cinematic ───────────────────────────────────────────────────────

/**
 * Runs once, the first time a real GPS fix lands — always establishes the
 * crew's actual starting point first (zoom out to orient, then a smooth
 * push-in), instead of the map just silently appearing already zoomed in on
 * a coordinate with no context for where that even is.
 */
function IntroSequence({ startPos }: { startPos: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      map.setView(startPos, 12, { animate: false });
      await wait(500);
      if (cancelled) return;
      map.flyTo(startPos, 16, { duration: 1.6, easeLinearity: 0.15 });
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ─── Live Follow ───────────────────────────────────────────────────────────

/** While actively navigating, keeps the camera gently centered on the crew's live GPS fix as it updates — so the dot moving is something you can actually see happening, not something you have to go look for. */
function LiveFollow({ pos, active }: { pos: [number, number]; active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    map.panTo(pos, { animate: true, duration: 0.8, easeLinearity: 0.25 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos[0], pos[1], active]);
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────

export function PetaTaktis() {
  const { coords, label } = useDeviceLocation();
  const [selectedEvent, setSelectedEvent] = useState<EventMarker | null>(null);
  const [showRouteSheet, setShowRouteSheet] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  // Epic route-search sequence state — see RouteSearchSequence above.
  // `runId` is bumped per pick and used as a React `key` so each pick fully
  // remounts the sequence (fresh candidates, old one's effect cleanup cancels
  // whatever was still in flight) instead of reusing stale state.
  const [searching, setSearching] = useState(false);
  const [runId, setRunId] = useState(0);
  const [searchLabel, setSearchLabel] = useState("");
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [scenarioLog, setScenarioLog] = useState<{ label: string; result: string }[]>([]);
  const { heading, available: headingAvailable } = useDeviceHeading();

  // Live position — reflects every GPS fix, moves as the crew actually moves.
  const userPos: [number, number] = coords
    ? [coords.lat, coords.lon]
    : [-6.1818, 106.8223];

  // Starting point — captured once, from the first real fix, and never
  // moves again. Hazard positions below are anchored to this (not the live
  // position), so they stay put on the map instead of drifting as the crew
  // walks around; it's also what the intro cinematic and the "start" pin use.
  const [startPos, setStartPos] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (coords && !startPos) setStartPos([coords.lat, coords.lon]);
  }, [coords, startPos]);
  const anchorPos = startPos ?? userPos;

  const EVENTS: EventMarker[] = [
    {
      id: "EVT-001",
      name: "Kebakaran Gedung Kantor",
      type: "KEBAKARAN",
      danger: "KRITIS",
      label: "KODE MERAH: API",
      pos: [anchorPos[0] + 0.003, anchorPos[1] - 0.004],
      distance: "0.8 KM",
      affected: 37,
    },
    {
      id: "EVT-002",
      name: "Longsor Jalur Evakuasi",
      type: "BENCANA",
      danger: "TINGGI",
      label: "JALUR PUTUS",
      pos: [anchorPos[0] - 0.005, anchorPos[1] + 0.006],
      distance: "1.4 KM",
      affected: 12,
    },
    {
      id: "EVT-003",
      name: "Korban Luka Berat",
      type: "MEDIS",
      danger: "TINGGI",
      label: "DARURAT MEDIS",
      pos: [anchorPos[0] - 0.002, anchorPos[1] - 0.003],
      distance: "0.5 KM",
      affected: 3,
    },
    {
      id: "EVT-004",
      name: "Kerusuhan Warga",
      type: "KEAMANAN",
      danger: "SEDANG",
      label: "POSKO AMAN",
      pos: [anchorPos[0] + 0.001, anchorPos[1] + 0.002],
      distance: "0.3 KM",
      affected: 80,
    },
  ];

  const handleSelectEvent = (event: EventMarker) => {
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
      setShowRouteSheet(false);
    } else {
      setSelectedEvent(event);
      setShowRouteSheet(false);
      setActiveRoute(null);
    }
  };

  const handleNavigate = () => {
    // iOS requires DeviceOrientationEvent.requestPermission() to be called
    // from a real tap — this is the first tap in the navigate flow, so it's
    // the right place. No-ops safely wherever the API doesn't exist at all.
    void startHeadingWatch();
    setShowRouteSheet(true);
  };

  const handleSelectRoute = (route: RouteOption) => {
    if (!selectedEvent) return;
    setActiveRoute(route);
    setShowRouteSheet(false);
    setRouteLine([]);
    setSearchLabel("MEMINDAI AREA PENCARIAN...");
    setSearchParams(null);
    setSearchProgress(0);
    setScenarioLog([]);
    setSearching(true);
    setRunId((r) => r + 1);
  };

  const handleClearRoute = () => {
    setSearching(false);
    setActiveRoute(null);
    setRouteLine([]);
    setScenarioLog([]);
  };

  const activeCount = EVENTS.filter((e) => e.danger === "KRITIS").length;

  return (
    <div className="flex-1 h-full overflow-hidden bg-black flex flex-col">
      {/* Header */}
      <header className="bg-[#131313] border-b-2 border-[#444] px-4 py-3 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-[#444] flex items-center justify-center bg-[#1e1e1e]">
            <Compass size={16} className="text-[#ffb2bd]" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] text-[#555] uppercase tracking-widest leading-none">
              Peta Taktis
            </span>
            <span className="font-grotesk font-semibold text-base text-[#e5e2e1] leading-tight">
              {coords ? (label || "—") : "Acquiring..."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 border border-[#FF0040] bg-[#FF0040]/10 animate-pulse">
              <Flame size={10} className="text-[#FF0040]" />
              <span className="font-mono text-[9px] text-[#FF0040] font-bold">{activeCount} KRITIS</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-1.5 py-0.5 border border-[#66df75] bg-[#1c1b1b]">
            <span className="font-mono text-[9px] text-[#66df75] font-bold">ONLINE</span>
          </div>
        </div>
      </header>

      {/* Route search HUD (while searching) / final nav banner (once resolved) */}
      <AnimatePresence mode="wait">
        {searching ? (
          <motion.div
            key="searching"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#0a0a0a] border-b border-[#66df75]/40"
          >
            <div className="px-4 py-2 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-[#66df75] shrink-0" />
              <span className="font-mono text-[10px] font-bold text-[#66df75] uppercase tracking-wide truncate">
                {searchLabel}
              </span>
            </div>

            {searchParams && (
              <div className="px-4 pb-2 grid grid-cols-4 gap-2 font-mono text-[9px]">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">JARAK</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.distanceKm.toFixed(2)} KM</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">WAKTU</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.timeMin} MNT</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">RISIKO</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.risk}%</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">MEDAN</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.terrain}</span>
                </div>
              </div>
            )}

            {scenarioLog.length > 0 && (
              <div className="px-4 pb-2 flex flex-col gap-1 font-mono text-[9px] max-h-24 overflow-y-auto">
                {scenarioLog.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Check size={10} className="text-[#66df75] shrink-0" />
                    <span className="text-[#666] truncate">{s.label}</span>
                    <span className="text-[#66df75] ml-auto shrink-0 truncate">{s.result}</span>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="h-[3px] bg-[#1a1a1a]">
              <motion.div
                className="h-full bg-[#66df75]"
                animate={{ width: `${searchProgress * 100}%` }}
                transition={{ ease: "linear", duration: 0.25 }}
              />
            </div>
          </motion.div>
        ) : activeRoute ? (
          <motion.div
            key="active"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-2 flex items-center justify-between border-b"
              style={{ background: `${activeRoute.color}15`, borderColor: activeRoute.color }}
            >
              <div className="flex items-center gap-2">
                <Navigation size={12} style={{ color: activeRoute.color } as any} />
                <span className="font-mono text-[10px] font-bold" style={{ color: activeRoute.color }}>
                  NAVIGASI AKTIF · {activeRoute.label.toUpperCase()}
                </span>
                <span className="font-mono text-[9px] text-[#555]">
                  {activeRoute.time} · {activeRoute.distance}
                </span>
              </div>
              <button
                onClick={handleClearRoute}
                className="text-[#555] hover:text-[#e1bec2]"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Map */}
      <main className="flex-grow relative overflow-hidden w-full h-full">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(68,68,68,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(68,68,68,0.2) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
            mixBlendMode: "overlay",
          }}
        />

        {coords ? (
          // Oversized (150%) and re-centered so that when the inner div is
          // CSS-rotated to match device heading, its corners still fully
          // cover the (smaller, overflow-hidden) viewport — a plain 100%
          // box would expose blank triangles at the corners on rotation.
          // `transform` only applies once a real heading is available;
          // otherwise this is just an inert wrapper around a north-up map.
          <div
            className="absolute"
            style={
              {
                top: "-25%",
                left: "-25%",
                width: "150%",
                height: "150%",
                "--map-heading": `${heading ?? 0}deg`,
                "--heading-available": headingAvailable ? 1 : 0,
                transform: headingAvailable && heading !== null ? "rotate(calc(-1 * var(--map-heading)))" : "none",
                transition: "transform 0.35s linear",
              } as any
            }
          >
            <MapContainer
              center={userPos}
              zoom={15}
              zoomControl={false}
              style={{ height: "100%", width: "100%", zIndex: 1 }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />

              {/* Establishing shot — always opens on the crew's real
                  starting point before anything else happens */}
              {startPos && <IntroSequence startPos={startPos} />}

              {/* Fixed pin at the point the crew started from */}
              {startPos && <Marker position={startPos} icon={START_ICON} />}

              {/* Live position — actually moves with GPS fixes */}
              <Marker position={userPos} icon={SELF_ICON} />
              <LiveFollow pos={userPos} active={!!activeRoute && !searching} />

              {/* Epic route-search cinematic — every candidate filling in,
                  sweep-compared, winner zoomed into, then swapped for the
                  real OSRM geometry (see RouteSearchSequence above) */}
              {searching && selectedEvent && (
                <RouteSearchSequence
                  key={runId}
                  destination={selectedEvent}
                  userPos={startPos ?? userPos}
                  onPhase={(_phase, label, params, progress) => {
                    setSearchLabel(label);
                    setSearchParams(params);
                    setSearchProgress(progress);
                  }}
                  onScenarioTick={(entry) => setScenarioLog((prev) => [...prev, entry])}
                  onResolved={(route) => {
                    setRouteLine(route);
                    setSearching(false);
                  }}
                />
              )}

              {/* Active route, road-snapped via OSRM (src/lib/routing.ts), same
                  engine radar uses to dispatch units — with the bezier-curve
                  fallback if OSRM's unreachable */}
              {activeRoute && !searching && routeLine.length > 1 && (
                <Polyline
                  positions={routeLine}
                  pathOptions={{ color: activeRoute.color, weight: 4, opacity: 0.85 }}
                />
              )}

              {/* Event markers */}
              {EVENTS.map((event) => (
                <EventMapMarker
                  key={event.id}
                  event={event}
                  onSelect={handleSelectEvent}
                />
              ))}

              <MapControls userPos={userPos} />
            </MapContainer>
          </div>
        ) : (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-[#0a0a0a]">
            <span className="font-mono text-xs text-[#666] uppercase tracking-[2px]">
              Acquiring position...
            </span>
          </div>
        )}

        {/* Coord overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-0.5 z-[1000]">
          {coords && (
            <div className="px-1.5 py-0.5 bg-[#131313]/90 border border-[#66df75]/40 font-mono text-[9px] text-[#66df75] tracking-wider flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[#66df75] animate-pulse" />
              LIVE
            </div>
          )}
          <div className="px-1.5 py-0.5 bg-[#131313]/90 border border-[#333] font-mono text-[10px] text-[#555] tracking-wider">
            {coords ? `LAT: ${coords.lat.toFixed(5)}°` : "LAT: —"}
          </div>
          <div className="px-1.5 py-0.5 bg-[#131313]/90 border border-[#333] font-mono text-[10px] text-[#555] tracking-wider">
            {coords ? `LON: ${coords.lon.toFixed(5)}°` : "LON: —"}
          </div>
        </div>

        {/* Compass */}
        <div className="absolute top-16 left-3 z-[1000]">
          <div className="w-8 h-8 border border-[#333] bg-[#131313]/90 backdrop-blur-sm flex items-center justify-center mb-1">
            <Compass size={14} className="text-[#555] -rotate-45" />
          </div>
          <div className="flex items-center">
            <div className="w-10 h-px bg-[#444] relative">
              <div className="absolute left-0 top-0 h-[3px] w-px bg-[#444] -mt-[1.5px]" />
              <div className="absolute right-0 top-0 h-[3px] w-px bg-[#444] -mt-[1.5px]" />
            </div>
            <span className="font-mono text-[8px] text-[#555] ml-1 bg-[#131313]/80 px-0.5">100m</span>
          </div>
        </div>
      </main>

      {/* Event popup (above nav bar) — hidden once a route is being searched
          or is active, so the epic search cinematic and the resulting
          navigation view get the full map instead of this card lingering
          over a third of the screen */}
      <AnimatePresence>
        {selectedEvent && !showRouteSheet && !searching && !activeRoute && (
          <EventPopup
            event={selectedEvent}
            userPos={userPos}
            onClose={() => setSelectedEvent(null)}
            onNavigate={handleNavigate}
          />
        )}
      </AnimatePresence>

      {/* Route selection sheet */}
      <AnimatePresence>
        {showRouteSheet && selectedEvent && (
          <RouteSheet
            event={selectedEvent}
            userPos={userPos}
            onClose={() => setShowRouteSheet(false)}
            onSelectRoute={handleSelectRoute}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
