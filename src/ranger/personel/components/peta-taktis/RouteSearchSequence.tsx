import { useEffect, useState } from "preact/hooks";
import { Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { fetchRoadRoute, buildFallbackRoute, animateRouteReveal, routeLengthMeters } from "@/lib/routing";
import { wait } from "./utils";
import type { EventMarker } from "./types";

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

export type SearchPhase = "scanning" | "generating" | "evaluating" | "winner" | "contingency";

export interface SearchParams {
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
export function RouteSearchSequence({
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
