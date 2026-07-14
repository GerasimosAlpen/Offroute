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
import { tasksApi } from "@/lib/api";
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
  /** Backend task ID for status/position updates */
  backendId?: string;
}

export interface ResolvedHazard {
  rangerId: string;
  rangerName: string;
  callsign: string;
}

interface TasksState {
  tasks: Record<string, RangerTask>;
  resolvedHazards: Record<string, ResolvedHazard>;
  rangerLastKnownPos: Record<string, [number, number]>;
  assign: (hazardId: string, base: { lat: number; lon: number }) => Promise<void>;
  setRangerPosition: (rangerId: string, pos: [number, number]) => void;
}

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
    if (get().tasks[hazardId]?.status === "enroute" || get().resolvedHazards[hazardId]) return;

    const hazard = HAZARDS.find((h) => h.id === hazardId);
    if (!hazard) return;

    const busyRangerIds = new Set(
      Object.values(get().tasks)
        .filter((t) => t.status === "enroute")
        .map((t) => t.rangerId),
    );
    const available = RANGERS.filter((r) => !busyRangerIds.has(r.id));
    if (available.length === 0) return;

    const target: [number, number] = [base.lat + hazard.offset[0], base.lon + hazard.offset[1]];

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
      const tasks = { ...s.tasks };
      for (const [key, t] of Object.entries(tasks)) {
        if (t.rangerId === nearest.id && t.status === "arrived") delete tasks[key];
      }
      tasks[hazardId] = { hazardId, rangerId: nearest.id, route: [start], unitPos: start, status: "enroute" };
      return { tasks, rangerLastKnownPos: { ...s.rangerLastKnownPos, [nearest.id]: start } };
    });

    // Persist assignment to backend (fire-and-forget — animation continues locally)
    tasksApi
      .assign({ hazardId, baseLat: base.lat, baseLon: base.lon })
      .then((savedTask) => {
        // Store backend ID for later status update
        set((s) => {
          const t = s.tasks[hazardId];
          if (!t) return s;
          return { tasks: { ...s.tasks, [hazardId]: { ...t, backendId: savedTask.id } } };
        });
      })
      .catch((err) => console.warn("[tasks] Failed to persist assign:", err));

    const route = (await fetchRoadRoute(start, target)) ?? buildFallbackRoute(start, target);

    if (!get().tasks[hazardId]) return;

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
    if (!finalTask) return;

    set((s) => ({
      tasks: { ...s.tasks, [hazardId]: { ...finalTask, route: [], unitPos: target, status: "arrived" } },
      resolvedHazards: {
        ...s.resolvedHazards,
        [hazardId]: { rangerId: nearest.id, rangerName: nearest.name, callsign: nearest.callsign },
      },
      rangerLastKnownPos: { ...s.rangerLastKnownPos, [nearest.id]: target },
    }));

    // Persist "arrived" status to backend
    if (finalTask.backendId) {
      tasksApi
        .updateStatus(finalTask.backendId, {
          status: "arrived",
          unitLat: target[0],
          unitLon: target[1],
        })
        .catch((err) => console.warn("[tasks] Failed to persist arrived status:", err));
    }

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
