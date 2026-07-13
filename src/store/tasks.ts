import { create } from "zustand";
import { RANGERS, type Ranger } from "@/lib/rangers";
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

export interface ResolvedHazard {
  rangerId: string;
  rangerName: string;
  callsign: string;
}

interface TasksState {
  /**
   * Keyed by hazardId — only the *live* task, while a ranger is actually
   * enroute or freshly arrived. Cleared once that ranger picks up a new
   * task elsewhere, so their marker doesn't keep showing at a place they've
   * left — see `resolvedHazards` for the permanent "this got handled"
   * record that survives that cleanup.
   */
  tasks: Record<string, RangerTask>;
  /** Permanent — "hazard X was resolved by ranger Y," even after Y has since moved on to something else. */
  resolvedHazards: Record<string, ResolvedHazard>;
  /**
   * Wherever each ranger last actually was, updated continuously while
   * enroute and pinned on arrival — so their *next* task starts from where
   * they really are, not their original static home position. Only what
   * doesn't fit on `RangerTask` because it needs to outlive any one task.
   */
  rangerLastKnownPos: Record<string, [number, number]>;
  /**
   * Ad-hoc version of the FLARE sequence's own dispatch: pick the nearest
   * free ranger, get a real route, glide them there, have them report in
   * (logged + pinned on the map) on arrival. Works for any hazard, not just
   * the earthquake drill — this is what "Budi takes the crash task" is.
   */
  assign: (hazardId: string, base: { lat: number; lon: number }) => Promise<void>;
  /**
   * FLARE's own dispatch sequence used to compute ranger positions from
   * their static home offset too, completely ignoring this store — so a
   * ranger who'd already moved via an ad-hoc task would "reset" to their
   * original spot the moment a FLARE fired. This is how FlareSequence keeps
   * this store updated as its own dispatched unit moves, so the two systems
   * agree on where everyone actually is.
   */
  setRangerPosition: (rangerId: string, pos: [number, number]) => void;
}

/** Wherever a ranger actually is, falling back to their static home offset if they've never moved. */
export function getRangerPosition(rangerId: string, fallback: [number, number]): [number, number] {
  return useTasksStore.getState().rangerLastKnownPos[rangerId] ?? fallback;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: {},
  resolvedHazards: {},
  rangerLastKnownPos: {},

  setRangerPosition: (rangerId, pos) =>
    set((s) => ({ rangerLastKnownPos: { ...s.rangerLastKnownPos, [rangerId]: pos } })),

  assign: async (hazardId, base) => {
    // Already being worked, or already resolved — either way, not up for grabs.
    if (get().tasks[hazardId]?.status === "enroute" || get().resolvedHazards[hazardId]) return;

    const hazard = HAZARDS.find((h) => h.id === hazardId);
    if (!hazard) return;

    // Only rangers currently *enroute* elsewhere are actually unavailable —
    // ones who already arrived and reported are free again. (Bug fixed:
    // this used to count every ranger who'd EVER completed a task as
    // permanently busy, since it didn't filter by status at all.)
    const busyRangerIds = new Set(
      Object.values(get().tasks)
        .filter((t) => t.status === "enroute")
        .map((t) => t.rangerId),
    );
    const available = RANGERS.filter((r) => !busyRangerIds.has(r.id));
    if (available.length === 0) return;

    const target: [number, number] = [base.lat + hazard.offset[0], base.lon + hazard.offset[1]];

    // Start from wherever this ranger actually last was, not their static
    // home offset. (Bug fixed: this used to always recompute from
    // `base + ranger.offset`, so a ranger who'd already moved would
    // teleport back to their original spot for every new task.)
    const posOf = (r: Ranger): [number, number] =>
      get().rangerLastKnownPos[r.id] ?? [base.lat + r.offset[0], base.lon + r.offset[1]];

    const nearest = available.reduce(
      (best, r) => {
        const pos = posOf(r);
        const d = metersBetween(pos, target);
        return d < best.d ? { r, d } : best;
      },
      { r: available[0], d: Infinity },
    ).r;

    const start = posOf(nearest);
    const log = useCommsLogStore.getState().append;

    log({
      sender: nearest.name,
      color: "#5fb3b3",
      lead: "TUGAS DITERIMA",
      body: `menuju ${hazard.label.toLowerCase()}, menghitung rute.`,
    });

    set((s) => {
      // Drop any previous *completed* task this ranger left behind so their
      // old "arrived" marker doesn't keep showing at a place they're no
      // longer at — the message pin from that visit stays as history,
      // this is just the live position marker.
      const tasks = { ...s.tasks };
      for (const [key, t] of Object.entries(tasks)) {
        if (t.rangerId === nearest.id && t.status === "arrived") delete tasks[key];
      }
      tasks[hazardId] = { hazardId, rangerId: nearest.id, route: [start], unitPos: start, status: "enroute" };
      return { tasks, rangerLastKnownPos: { ...s.rangerLastKnownPos, [nearest.id]: start } };
    });

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
        set((s) => ({
          tasks: { ...s.tasks, [hazardId]: { ...current, route: partial, unitPos: tip } },
          rangerLastKnownPos: { ...s.rangerLastKnownPos, [nearest.id]: tip },
        }));
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
        set((s) => ({
          tasks: { ...s.tasks, [hazardId]: { ...current, unitPos: pos } },
          rangerLastKnownPos: { ...s.rangerLastKnownPos, [nearest.id]: pos },
        }));
      },
      () => !get().tasks[hazardId],
    );

    const finalTask = get().tasks[hazardId];
    if (!finalTask) return; // cleared mid-flight

    set((s) => ({
      // Route cleared on arrival — it's done its job, no need to keep the
      // bright animated line drawn once the ranger's actually there.
      tasks: { ...s.tasks, [hazardId]: { ...finalTask, route: [], unitPos: target, status: "arrived" } },
      resolvedHazards: {
        ...s.resolvedHazards,
        [hazardId]: { rangerId: nearest.id, rangerName: nearest.name, callsign: nearest.callsign },
      },
      rangerLastKnownPos: { ...s.rangerLastKnownPos, [nearest.id]: target },
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
