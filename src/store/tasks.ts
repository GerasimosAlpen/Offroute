import { create } from "zustand";
import { RANGERS, type Ranger } from "@/lib/rangers";
import { HAZARDS, arrivalReportFor, type HazardData } from "@/lib/hazards";
import { metersBetween } from "@/lib/routing";
import { tasksApi, type AssignTaskDto, type SelfAssignTaskDto } from "@/lib/api";
import { driveTransitAnimation } from "./taskAnimation";
import { socket } from "@/lib/socket";
import { cacheGetAll, cacheSet, enqueueMutation, registerReplayHandler } from "@/lib/offlineCache";
import { useCommsLogStore } from "./commsLog";
import { useMessagePinsStore } from "./messagePins";

/**
 * A live dispatch, through its full lifecycle:
 *  - `enroute`  — unit moving toward the hazard
 *  - `onscene`  — unit physically arrived, working (client-only distinction;
 *                 the backend still calls this `enroute`)
 *  - `reported` — field unit tapped "done", awaiting radar confirmation
 *                 (backend `arrived`). The hazard stays visibly active on
 *                 both sides until radar confirms — that's the handshake.
 * Radar confirming writes a permanent ResolvedHazard and clears the task.
 */
export interface RangerTask {
  hazardId: string;
  rangerId: string;
  rangerName: string;
  callsign: string;
  /** Full real route (for drawing) — starts as just [start] until OSRM resolves. */
  route: [number, number][];
  /** Live, smoothly-interpolated position. */
  unitPos: [number, number];
  status: "enroute" | "onscene" | "reported";
  /** True when the field unit assigned itself, vs radar dispatching it. */
  selfAssigned: boolean;
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

interface ApiResolved {
  hazardId: string;
  rangerId: string;
  rangerName: string;
  callsign: string;
}

interface TaskUpdatePayload {
  hazardId?: string;
  rangerId?: string;
  status?: "enroute" | "arrived";
  unitLat?: number;
  unitLon?: number;
  rangerName?: string;
  callsign?: string;
  selfAssigned?: boolean;
}

interface TaskLifecyclePayload {
  hazardId?: string;
  rangerId?: string;
  rangerName?: string;
  callsign?: string;
}

interface RangerPositionPayload {
  rangerId?: string;
  lat?: number;
  lon?: number;
}

/**
 * Live query data threaded in from the dispatch call site
 * (HazardStatusPanel renders `useIncidents()`/`usePersonnel()` — the same
 * lists the operator is actually looking at). Without this, `assign()`
 * could only ever find hazards/rangers in the static seed arrays, so a
 * NEW incident (reported via POST /incidents) was silently undispatchable.
 */
export interface AssignContext {
  hazards?: HazardData[];
  personnel?: Ranger[];
}

interface TasksState {
  tasks: Record<string, RangerTask>;
  resolvedHazards: Record<string, ResolvedHazard>;
  rangerLastKnownPos: Record<string, [number, number]>;
  loaded: boolean;
  loadTasks: () => Promise<void>;
  assign: (hazardId: string, base: { lat: number; lon: number }, ctx?: AssignContext) => Promise<void>;
  selfAssign: (hazardId: string, ranger: Ranger, from: [number, number], to: [number, number], hazardLabel: string) => Promise<void>;
  reportDone: (hazardId: string, hazard?: HazardData) => Promise<void>;
  confirmDone: (hazardId: string) => Promise<void>;
  rejectDone: (hazardId: string) => Promise<void>;
  setRangerPosition: (rangerId: string, pos: [number, number]) => void;
}

export function getRangerPosition(rangerId: string, fallback: [number, number]): [number, number] {
  return useTasksStore.getState().rangerLastKnownPos[rangerId] ?? fallback;
}

/** True when a hazard already has a live unit (enroute/onscene/reported) — the double-dispatch guard every dispatch path consults. */
export function hazardHasActiveUnit(hazardId: string): boolean {
  return Boolean(useTasksStore.getState().tasks[hazardId]) || Boolean(useTasksStore.getState().resolvedHazards[hazardId]);
}

/**
 * A position learned from another device (presence heartbeat, WS echo) —
 * unlike `setRangerPosition`, this respects the locally-driven guard so a
 * glide this tab is animating itself is never yanked around by the slower
 * remote signal for the same ranger.
 */
export function reportRemoteRangerPosition(rangerId: string, pos: [number, number]): void {
  if (locallyDrivenRangers.has(rangerId)) return;
  useTasksStore.getState().setRangerPosition(rangerId, pos);
}

// Hazards/rangers this browser tab is itself actively driving an animation
// for — `task-update`/`ranger-position` broadcasts are only ever a snap-to
// (no route, no glide), so echoes of this client's own dispatch must be
// ignored or they'd fight the smooth local animation every tick.
const locallyDrivenHazards = new Set<string>();
const locallyDrivenRangers = new Set<string>();

// Radar identity for comms lines the dispatch flow posts on the operator's
// behalf — "Command / HQ", never "ANDA".
const HQ = "HQ";
const HQ_COLOR = "#ffb2bd";
const UNIT_COLOR = "#5fb3b3";

function comms() {
  return useCommsLogStore.getState().append;
}

// Replay queued dispatch calls once back online.
registerReplayHandler("tasksApi.assign", async (payload) => {
  await tasksApi.assign(payload as AssignTaskDto);
});
registerReplayHandler("tasksApi.selfAssign", async (payload) => {
  await tasksApi.selfAssign(payload as SelfAssignTaskDto);
});
registerReplayHandler("tasksApi.confirm", async (payload) => {
  await tasksApi.confirm((payload as { backendId: string }).backendId);
});
registerReplayHandler("tasksApi.reject", async (payload) => {
  await tasksApi.reject((payload as { backendId: string }).backendId);
});

function nameFor(rangerId: string, fromPayload?: { rangerName?: string; callsign?: string }) {
  const known = RANGERS.find((r) => r.id === rangerId);
  return {
    rangerName: fromPayload?.rangerName ?? known?.name ?? rangerId,
    callsign: fromPayload?.callsign ?? known?.callsign ?? "",
  };
}

export const useTasksStore = create<TasksState>((set, get) => {
  // Another client dispatched or a unit reported done — reflect it here.
  socket.on("task-update", (payload: TaskUpdatePayload) => {
    try {
      const { hazardId, rangerId, status, unitLat, unitLon } = payload ?? {};
      if (!hazardId || !rangerId || !status || typeof unitLat !== "number" || typeof unitLon !== "number") return;
      if (locallyDrivenHazards.has(hazardId)) return; // echo of our own dispatch

      const { rangerName, callsign } = nameFor(rangerId, payload);
      set((s) => {
        const existing = s.tasks[hazardId];
        // `arrived` from the backend = the field unit reported done. Keep the
        // task (as `reported`) so radar can confirm — do NOT delete or resolve.
        const nextStatus: RangerTask["status"] = status === "arrived" ? "reported" : existing?.status === "onscene" ? "onscene" : "enroute";
        return {
          tasks: {
            ...s.tasks,
            [hazardId]: {
              hazardId,
              rangerId,
              rangerName,
              callsign,
              route: existing?.route ?? [],
              unitPos: [unitLat, unitLon],
              status: nextStatus,
              selfAssigned: payload.selfAssigned ?? existing?.selfAssigned ?? false,
              backendId: existing?.backendId,
            },
          },
          rangerLastKnownPos: { ...s.rangerLastKnownPos, [rangerId]: [unitLat, unitLon] },
        };
      });
    } catch (err) {
      console.warn("[tasks] Malformed task-update payload, ignored:", err);
    }
  });

  // Radar confirmed a completion — clear the live task, record the resolution.
  socket.on("task-confirmed", (payload: TaskLifecyclePayload) => {
    try {
      const { hazardId, rangerId } = payload ?? {};
      if (!hazardId || !rangerId) return;
      const { rangerName, callsign } = nameFor(rangerId, payload);
      set((s) => {
        const tasks = { ...s.tasks };
        delete tasks[hazardId];
        return {
          tasks,
          resolvedHazards: { ...s.resolvedHazards, [hazardId]: { rangerId, rangerName, callsign } },
        };
      });
    } catch (err) {
      console.warn("[tasks] Malformed task-confirmed payload, ignored:", err);
    }
  });

  // Radar rejected a completion report — unit goes back to working.
  socket.on("task-rejected", (payload: TaskLifecyclePayload) => {
    try {
      const { hazardId } = payload ?? {};
      if (!hazardId) return;
      set((s) => {
        const existing = s.tasks[hazardId];
        if (!existing) return s;
        return { tasks: { ...s.tasks, [hazardId]: { ...existing, status: "onscene" } } };
      });
    } catch (err) {
      console.warn("[tasks] Malformed task-rejected payload, ignored:", err);
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

      const applyLive = (remote: ApiTask[]) => {
        set((s) => {
          const tasks = { ...s.tasks };
          const rangerLastKnownPos = { ...s.rangerLastKnownPos };
          for (const t of remote) {
            if (!t?.hazardId || !t?.rangerId) continue; // skip malformed rows rather than crash hydration
            if (!tasks[t.hazardId]) {
              const { rangerName, callsign } = nameFor(t.rangerId, {
                rangerName: t.ranger?.name,
                callsign: t.ranger?.callsign,
              });
              // Snap only — this tab has no OSRM route history for a task
              // another client started. `arrived` → reported (awaiting confirm).
              tasks[t.hazardId] = {
                hazardId: t.hazardId,
                rangerId: t.rangerId,
                rangerName,
                callsign,
                route: [],
                unitPos: [t.unitLat, t.unitLon],
                status: t.status === "arrived" ? "reported" : "enroute",
                selfAssigned: false,
                backendId: t.id,
              };
            }
            rangerLastKnownPos[t.rangerId] ??= [t.unitLat, t.unitLon];
          }
          return { tasks, rangerLastKnownPos, loaded: true };
        });
      };

      // Confirmed resolutions hydrate separately now that `arrived` ≠ done.
      const loadResolved = async () => {
        try {
          const resolved: ApiResolved[] = await tasksApi.resolved();
          set((s) => {
            const resolvedHazards = { ...s.resolvedHazards };
            for (const r of resolved) {
              if (!r?.hazardId) continue;
              resolvedHazards[r.hazardId] ??= { rangerId: r.rangerId, rangerName: r.rangerName, callsign: r.callsign };
            }
            return { resolvedHazards };
          });
          void cacheSet("resolvedHazards", resolved.map((r) => ({ id: r.hazardId, ...r })));
        } catch (err) {
          console.warn("[tasks] Failed to load resolved from API:", err);
          const cached = await cacheGetAll<ApiResolved>("resolvedHazards");
          if (cached.length > 0) {
            set((s) => {
              const resolvedHazards = { ...s.resolvedHazards };
              for (const r of cached) resolvedHazards[r.hazardId] ??= { rangerId: r.rangerId, rangerName: r.rangerName, callsign: r.callsign };
              return { resolvedHazards };
            });
          }
        }
      };

      try {
        const remote: ApiTask[] = await tasksApi.list();
        applyLive(remote);
        void cacheSet("tasks", remote);
      } catch (err) {
        console.warn("[tasks] Failed to load tasks from API:", err);
        const cached = await cacheGetAll<ApiTask>("tasks");
        if (cached.length > 0) applyLive(cached);
        else set({ loaded: true });
      }
      await loadResolved();
    },

    assign: async (hazardId, base, ctx) => {
      // Double-dispatch guard — a hazard with any live unit (dispatched or
      // self-assigned) or an existing resolution is never re-dispatched.
      if (hazardHasActiveUnit(hazardId)) return;

      const hazardList = ctx?.hazards?.length ? ctx.hazards : HAZARDS;
      const roster = ctx?.personnel?.length ? ctx.personnel : RANGERS;

      const hazard = hazardList.find((h) => h.id === hazardId);
      if (!hazard) return;

      const busyRangerIds = new Set(Object.values(get().tasks).map((t) => t.rangerId));
      const available = roster.filter((r) => !busyRangerIds.has(r.id));
      if (available.length === 0) return;

      const target: [number, number] = [base.lat + hazard.offset[0], base.lon + hazard.offset[1]];
      const posOf = (r: Ranger): [number, number] =>
        get().rangerLastKnownPos[r.id] ?? [base.lat + r.offset[0], base.lon + r.offset[1]];

      const nearest = available.reduce(
        (best, r) => {
          const d = metersBetween(posOf(r), target);
          return d < best.d ? { r, d } : best;
        },
        { r: available[0], d: Infinity },
      ).r;

      const start = posOf(nearest);
      const senderName = `${nearest.name} (${nearest.callsign})`;
      const assignDto: AssignTaskDto = { hazardId, baseLat: base.lat, baseLon: base.lon };

      // Auto-open the comms frequency for this unit the moment we dispatch —
      // fast, before any routing math — so the operator sees the channel is live.
      comms()({ sender: HQ, color: HQ_COLOR, lead: "KIRIM UNIT", body: `${senderName}, tangani ${hazard.label.toLowerCase()}. Frekuensi dibuka.` });

      await drive({ hazardId, ranger: nearest, start, target, hazard, selfAssigned: false, senderName, persist: () => tasksApi.assign(assignDto), queue: () => enqueueMutation({ domain: "tasks", method: "tasksApi.assign", payload: assignDto }) });
    },

    selfAssign: async (hazardId, ranger, from, to, hazardLabel) => {
      if (hazardHasActiveUnit(hazardId)) return; // someone's already on it

      const senderName = `${ranger.name} (${ranger.callsign})`;
      // Backend records the unit's current position; it then glides to the incident.
      const dto: SelfAssignTaskDto = { hazardId, rangerId: ranger.id, unitLat: from[0], unitLon: from[1] };

      comms()({ sender: senderName, color: UNIT_COLOR, lead: "AMBIL TUGAS", body: `menangani ${hazardLabel.toLowerCase()} secara mandiri, tidak perlu kirim unit lain.` });

      await drive({ hazardId, ranger, start: from, target: to, selfAssigned: true, senderName, persist: () => tasksApi.selfAssign(dto), queue: () => enqueueMutation({ domain: "tasks", method: "tasksApi.selfAssign", payload: dto }) });
    },

    reportDone: async (hazardId, hazard) => {
      const task = get().tasks[hazardId];
      if (!task || task.status === "reported") return;

      set((s) => ({ tasks: { ...s.tasks, [hazardId]: { ...task, status: "reported" } } }));

      const reportText = hazard ? arrivalReportFor(hazard) : "penanganan selesai di lokasi.";
      comms()({ sender: `${task.rangerName} (${task.callsign})`, color: UNIT_COLOR, lead: "MINTA KONFIRMASI", body: `${reportText} Menunggu konfirmasi HQ.` });
      useMessagePinsStore.getState().addPin({
        rangerId: task.rangerId,
        rangerName: task.rangerName,
        callsign: task.callsign,
        text: reportText,
        lat: task.unitPos[0],
        lon: task.unitPos[1],
      });

      if (task.backendId) {
        tasksApi
          .updateStatus(task.backendId, { status: "arrived", unitLat: task.unitPos[0], unitLon: task.unitPos[1] })
          .catch((err) => console.warn("[tasks] Failed to persist completion report:", err));
      }
    },

    confirmDone: async (hazardId) => {
      const task = get().tasks[hazardId];
      if (!task) return;

      set((s) => {
        const tasks = { ...s.tasks };
        delete tasks[hazardId];
        return {
          tasks,
          resolvedHazards: { ...s.resolvedHazards, [hazardId]: { rangerId: task.rangerId, rangerName: task.rangerName, callsign: task.callsign } },
        };
      });
      comms()({ sender: HQ, color: HQ_COLOR, lead: "DIKONFIRMASI", body: `tugas ${task.rangerName} (${task.callsign}) selesai dan dikonfirmasi. Terima kasih, kembali siaga.` });

      if (task.backendId) {
        tasksApi.confirm(task.backendId).catch((err) => {
          console.warn("[tasks] Failed to persist confirmation:", err);
          void enqueueMutation({ domain: "tasks", method: "tasksApi.confirm", payload: { backendId: task.backendId } });
        });
      }
    },

    rejectDone: async (hazardId) => {
      const task = get().tasks[hazardId];
      if (!task || task.status !== "reported") return;

      set((s) => ({ tasks: { ...s.tasks, [hazardId]: { ...task, status: "onscene" } } }));
      comms()({ sender: HQ, color: HQ_COLOR, lead: "DIKEMBALIKAN", body: `${task.rangerName} (${task.callsign}), laporan belum bisa dikonfirmasi — lanjutkan penanganan.` });

      if (task.backendId) {
        tasksApi.reject(task.backendId).catch((err) => {
          console.warn("[tasks] Failed to persist rejection:", err);
          void enqueueMutation({ domain: "tasks", method: "tasksApi.reject", payload: { backendId: task.backendId } });
        });
      }
    },
  };

  /**
   * Shared dispatch driver for both radar `assign` and personel `selfAssign`:
   * optimistic enroute state → backend persist (fire-and-forget, offline-
   * queued) → OSRM route reveal + glide → onscene. It deliberately stops at
   * onscene: completion is the field unit's call (`reportDone`), confirmed by
   * radar (`confirmDone`).
   */
  async function drive(opts: {
    hazardId: string;
    ranger: Ranger;
    start: [number, number];
    target: [number, number];
    hazard?: HazardData;
    selfAssigned: boolean;
    senderName: string;
    persist: () => Promise<{ id: string }>;
    queue: () => Promise<void> | void;
  }) {
    const { hazardId, ranger, start, target, selfAssigned, senderName, persist, queue } = opts;

    locallyDrivenHazards.add(hazardId);
    locallyDrivenRangers.add(ranger.id);
    try {
      set((s) => ({
        tasks: {
          ...s.tasks,
          [hazardId]: {
            hazardId,
            rangerId: ranger.id,
            rangerName: ranger.name,
            callsign: ranger.callsign,
            route: [start],
            unitPos: start,
            status: "enroute",
            selfAssigned,
          },
        },
        rangerLastKnownPos: { ...s.rangerLastKnownPos, [ranger.id]: start },
      }));

      persist()
        .then((saved) => {
          set((s) => {
            const t = s.tasks[hazardId];
            if (!t) return s;
            return { tasks: { ...s.tasks, [hazardId]: { ...t, backendId: saved.id } } };
          });
        })
        .catch((err) => {
          console.warn("[tasks] Failed to persist dispatch:", err);
          void queue();
        });

      const arrived = await driveTransitAnimation({
        start,
        target,
        isCancelled: () => !get().tasks[hazardId],
        onTick: ({ route, unitPos }) => {
          const current = get().tasks[hazardId];
          if (!current) return;
          set((s) => ({
            tasks: { ...s.tasks, [hazardId]: { ...current, ...(route && { route }), unitPos } },
            rangerLastKnownPos: { ...s.rangerLastKnownPos, [ranger.id]: unitPos },
          }));
        },
        getBackendId: () => get().tasks[hazardId]?.backendId,
      });
      if (!arrived) return;

      const current = get().tasks[hazardId];
      if (!current) return;

      // Arrived on scene — working, NOT done. Route clears, status → onscene.
      set((s) => ({
        tasks: { ...s.tasks, [hazardId]: { ...current, route: [], unitPos: target, status: "onscene" } },
        rangerLastKnownPos: { ...s.rangerLastKnownPos, [ranger.id]: target },
      }));
      comms()({ sender: senderName, color: UNIT_COLOR, lead: "TIBA", body: "di lokasi, memulai penanganan." });
    } finally {
      locallyDrivenHazards.delete(hazardId);
      locallyDrivenRangers.delete(ranger.id);
    }
  }
});
