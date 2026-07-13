import { create } from "zustand";
import { RANGERS } from "@/lib/rangers";
import { HAZARDS, arrivalReportFor } from "@/lib/hazards";
import {
  fetchRoadRoute,
  buildFallbackRoute,
  metersBetween,
  animateAlongRoute,
  animateRouteReveal,
  simulatedTravelDurationMs,
} from "@/lib/routing";
import { useCommsLogStore } from "./commsLog";
import { useMessagePinsStore } from "./messagePins";

export interface RangerTask {
  hazardId: string;
  rangerId: string;
  /** Full real route (for drawing) — starts as just [start] until OSRM resolves. */
  route: [number, number][];
  /** Live, smoothly-interpolated position. */
  unitPos: [number, number];
  status: "enroute" | "arrived";
}

interface TasksState {
  /** Keyed by hazardId — one active/finished task per hazard at a time. */
  tasks: Record<string, RangerTask>;
  /**
   * Ad-hoc version of the FLARE sequence's own dispatch: pick the nearest
   * free ranger, get a real route, glide them there, have them report in
   * (logged + pinned on the map) on arrival. Works for any hazard, not just
   * the earthquake drill — this is what "Budi takes the crash task" is.
   */
  assign: (hazardId: string, base: { lat: number; lon: number }) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: {},

  assign: async (hazardId, base) => {
    if (get().tasks[hazardId]) return; // already taken

    const hazard = HAZARDS.find((h) => h.id === hazardId);
    if (!hazard) return;

    const busyRangerIds = new Set(Object.values(get().tasks).map((t) => t.rangerId));
    const available = RANGERS.filter((r) => !busyRangerIds.has(r.id));
    if (available.length === 0) return;

    const target: [number, number] = [base.lat + hazard.offset[0], base.lon + hazard.offset[1]];

    const nearest = available.reduce(
      (best, r) => {
        const pos: [number, number] = [base.lat + r.offset[0], base.lon + r.offset[1]];
        const d = metersBetween(pos, target);
        return d < best.d ? { r, d } : best;
      },
      { r: available[0], d: Infinity },
    ).r;

    const start: [number, number] = [base.lat + nearest.offset[0], base.lon + nearest.offset[1]];
    const log = useCommsLogStore.getState().append;

    log({
      sender: nearest.name,
      color: "#5fb3b3",
      lead: "TUGAS DITERIMA",
      body: `menuju ${hazard.label.toLowerCase()}, menghitung rute.`,
    });

    set((s) => ({
      tasks: {
        ...s.tasks,
        [hazardId]: { hazardId, rangerId: nearest.id, route: [start], unitPos: start, status: "enroute" },
      },
    }));

    const route = (await fetchRoadRoute(start, target)) ?? buildFallbackRoute(start, target);

    // The task may have been cleared while we were waiting on the route.
    if (!get().tasks[hazardId]) return;

    // Draw the route from start to end instead of it just appearing — the
    // ranger's own marker leads the tip, like it's scouting the path live.
    await animateRouteReveal(
      route,
      900,
      (partial) => {
        const current = get().tasks[hazardId];
        if (!current) return;
        const tip = partial[partial.length - 1];
        set((s) => ({ tasks: { ...s.tasks, [hazardId]: { ...current, route: partial, unitPos: tip } } }));
      },
      () => !get().tasks[hazardId],
    );
    if (!get().tasks[hazardId]) return;

    const durationMs = simulatedTravelDurationMs(route);

    await animateAlongRoute(
      route,
      durationMs,
      (pos) => {
        const current = get().tasks[hazardId];
        if (!current) return;
        set((s) => ({ tasks: { ...s.tasks, [hazardId]: { ...current, unitPos: pos } } }));
      },
      () => !get().tasks[hazardId],
    );

    const finalTask = get().tasks[hazardId];
    if (!finalTask) return; // cleared mid-flight

    set((s) => ({
      tasks: { ...s.tasks, [hazardId]: { ...finalTask, unitPos: target, status: "arrived" } },
    }));

    const reportText = arrivalReportFor(hazard);
    log({ sender: nearest.name, color: "#5fb3b3", lead: "TIBA", body: reportText });
    useMessagePinsStore.getState().addPin({
      rangerId: nearest.id,
      rangerName: nearest.name,
      callsign: nearest.callsign,
      text: reportText,
      lat: target[0],
      lon: target[1],
    });
  },
}));
