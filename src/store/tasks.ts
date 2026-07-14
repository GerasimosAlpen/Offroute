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
import { socket } from "@/lib/socket";
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

interface ApiTask {
  id: string;
  hazardId: string;
  rangerId: string;
  status: "enroute" | "arrived";
  unitLat: number;
  unitLon: number;
  ranger?: { name?: string; callsign?: string };
}

interface TaskUpdatePayload {
  hazardId?: string;
  rangerId?: string;
  status?: "enroute" | "arrived";
  unitLat?: number;
  unitLon?: number;
}

interface RangerPositionPayload {
  rangerId?: string;
  lat?: number;
  lon?: number;
}

interface TasksState {
  tasks: Record<string, RangerTask>;
  resolvedHazards: Record<string, ResolvedHazard>;
  rangerLastKnownPos: Record<string, [number, number]>;
  loaded: boolean;
  loadTasks: () => Promise<void>;
  assign: (hazardId: string, base: { lat: number; lon: number }) => Promise<void>;
  setRangerPosition: (rangerId: string, pos: [number, number]) => void;
}

export function getRangerPosition(rangerId: string, fallback: [number, number]): [number, number] {
  return useTasksStore.getState().rangerLastKnownPos[rangerId] ?? fallback;
}

// Hazards/rangers this browser tab is itself actively driving an animation
// for — `task-update`/`ranger-position` broadcasts are only ever a snap-to
// (no route, no glide), so echoes of this client's own `assign()` call must
// be ignored or they'd fight the smooth local animation every tick.
const locallyDrivenHazards = new Set<string>();
const locallyDrivenRangers = new Set<string>();

export const useTasksStore = create<TasksState>((set, get) => {
  // Real-time: reflect other clients' dispatches/arrivals on this map too
  socket.on("task-update", (payload: TaskUpdatePayload) => {
    try {
      const { hazardId, rangerId, status, unitLat, unitLon } = payload ?? {};
      if (!hazardId || !rangerId || !status || typeof unitLat !== "number" || typeof unitLon !== "number") return;
      if (locallyDrivenHazards.has(hazardId)) return; // echo of our own assign()

      set((s) => {
        const tasks = { ...s.tasks };
        if (status === "arrived") {
          delete tasks[hazardId];
        } else {
          tasks[hazardId] = { hazardId, rangerId, route: [], unitPos: [unitLat, unitLon], status };
        }
        const resolvedHazards =
          status === "arrived"
            ? {
                ...s.resolvedHazards,
                [hazardId]: {
                  rangerId,
                  rangerName: RANGERS.find((r) => r.id === rangerId)?.name ?? rangerId,
                  callsign: RANGERS.find((r) => r.id === rangerId)?.callsign ?? "",
                },
              }
            : s.resolvedHazards;
        return {
          tasks,
          resolvedHazards,
          rangerLastKnownPos: { ...s.rangerLastKnownPos, [rangerId]: [unitLat, unitLon] },
        };
      });
    } catch (err) {
      console.warn("[tasks] Malformed task-update payload, ignored:", err);
    }
  });

  socket.on("ranger-position", (payload: RangerPositionPayload) => {
    try {
      const { rangerId, lat, lon } = payload ?? {};
      if (!rangerId || typeof lat !== "number" || typeof lon !== "number") return;
      if (locallyDrivenRangers.has(rangerId)) return; // we're already animating this ranger ourselves
      set((s) => ({ rangerLastKnownPos: { ...s.rangerLastKnownPos, [rangerId]: [lat, lon] } }));
    } catch (err) {
      console.warn("[tasks] Malformed ranger-position payload, ignored:", err);
    }
  });

  return {
    tasks: {},
    resolvedHazards: {},
    rangerLastKnownPos: {},
    loaded: false,

    setRangerPosition: (rangerId, pos) =>
      set((s) => ({ rangerLastKnownPos: { ...s.rangerLastKnownPos, [rangerId]: pos } })),

    loadTasks: async () => {
      if (get().loaded) return;
      try {
        const remote: ApiTask[] = await tasksApi.list();
        set((s) => {
          const tasks = { ...s.tasks };
          const resolvedHazards = { ...s.resolvedHazards };
          const rangerLastKnownPos = { ...s.rangerLastKnownPos };
          for (const t of remote) {
            if (!t?.hazardId || !t?.rangerId) continue; // skip malformed rows rather than crash hydration
            if (t.status === "arrived") {
              resolvedHazards[t.hazardId] ??= {
                rangerId: t.rangerId,
                rangerName: t.ranger?.name ?? t.rangerId,
                callsign: t.ranger?.callsign ?? "",
              };
            } else if (!tasks[t.hazardId]) {
              // Snap only — this tab has no OSRM route history for a task another client started
              tasks[t.hazardId] = {
                hazardId: t.hazardId,
                rangerId: t.rangerId,
                route: [],
                unitPos: [t.unitLat, t.unitLon],
                status: "enroute",
                backendId: t.id,
              };
            }
            rangerLastKnownPos[t.rangerId] ??= [t.unitLat, t.unitLon];
          }
          return { tasks, resolvedHazards, rangerLastKnownPos, loaded: true };
        });
      } catch (err) {
        console.warn("[tasks] Failed to load tasks from API:", err);
        set({ loaded: true });
      }
    },

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

      // Mark as locally-driven so this client's own `task-update`/
      // `ranger-position` broadcasts (which echo back to the sender too)
      // don't get treated as a remote update and overwrite the live glide.
      locallyDrivenHazards.add(hazardId);
      locallyDrivenRangers.add(nearest.id);

      try {
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

        // Persist assignment to backend (fire-and-forget — animation continues locally
        // regardless of whether/when this resolves, so a slow or failed backend never
        // blocks or breaks the on-screen dispatch)
        tasksApi
          .assign({ hazardId, baseLat: base.lat, baseLon: base.lon })
          .then((savedTask) => {
            set((s) => {
              const t = s.tasks[hazardId];
              if (!t) return s;
              return { tasks: { ...s.tasks, [hazardId]: { ...t, backendId: savedTask.id } } };
            });
          })
          .catch((err) => console.warn("[tasks] Failed to persist assign:", err));

        let route: [number, number][];
        try {
          route = (await fetchRoadRoute(start, target)) ?? buildFallbackRoute(start, target);
        } catch (err) {
          console.warn("[tasks] Route fetch threw unexpectedly, using fallback curve:", err);
          route = buildFallbackRoute(start, target);
        }

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

        // Stream position to the backend during transit too (not just at
        // arrival) so `POST /tasks/:id/position` and its `ranger-position`
        // broadcast actually get used — throttled, since this fires on every
        // animation frame and the backend doesn't need frame-rate updates.
        let lastPositionSentAt = 0;
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

            const backendId = get().tasks[hazardId]?.backendId;
            const now = performance.now();
            if (backendId && now - lastPositionSentAt > 400) {
              lastPositionSentAt = now;
              tasksApi
                .updatePosition(backendId, pos[0], pos[1])
                .catch((err) => console.warn("[tasks] Failed to stream position:", err));
            }
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
      } finally {
        locallyDrivenHazards.delete(hazardId);
        locallyDrivenRangers.delete(nearest.id);
      }
    },
  };
});
