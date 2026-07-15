import { useMap } from "react-leaflet";
import { type Ranger } from "@/lib/rangers";
import { useIncidents } from "@/hooks/useIncidents";
import { usePersonnel } from "@/hooks/usePersonnel";
import { useFlareChoreography } from "./flare/useFlareChoreography";
import { FlareLayers } from "./flare/FlareLayers";

export type FlarePhase = "idle" | "detect" | "scan" | "dispatch" | "enroute" | "arrived" | "reporting" | "calm";

export interface FlareProgress {
  unitsDispatched: number;
  totalUnits: number;
  etaMs: number | null;
}

export const ACTIVE_DRILL_PHASES: FlarePhase[] = ["detect", "scan", "dispatch", "enroute", "arrived", "reporting"];

/**
 * The FLARE drill: freeze-frame beat → detect → zoom out to available
 * rangers → pick nearest → animate them along a route (leaving a comet
 * trail, spawning a second victim partway through) → arrive → other teams
 * report in → settle to a calm-but-still-searching state.
 *
 * Split in two: `useFlareChoreography` owns the scripted state machine
 * (timing, phases, dispatch logic), `FlareLayers` renders whatever state
 * it's in onto the Leaflet map. Everything here (mesh peers, routing,
 * "another victim") is simulated — see TODO.md. Only the magnitude number
 * is real (BMKG).
 */
export function FlareSequence({
  sequence,
  ranger,
  magnitude,
  onPhaseChange,
  onProgress,
}: {
  sequence: number;
  ranger: { lat: number; lon: number };
  magnitude: number;
  onPhaseChange: (phase: FlarePhase, banner: string | null) => void;
  onProgress: (progress: FlareProgress) => void;
}) {
  const map = useMap();
  const { data: personnel = [] } = usePersonnel();
  const { data: hazards = [] } = useIncidents();

  const state = useFlareChoreography({
    sequence,
    ranger,
    magnitude,
    map,
    personnel: personnel as unknown as Ranger[],
    hazards,
    onPhaseChange,
    onProgress,
  });

  return <FlareLayers personnel={personnel as unknown as Ranger[]} {...state} />;
}
