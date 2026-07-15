import {
  fetchRoadRoute,
  buildFallbackRoute,
  animateAlongRoute,
  animateRouteReveal,
  simulatedTravelDurationMs,
} from "@/lib/routing";
import { tasksApi } from "@/lib/api";

/** How often (ms) transit positions are streamed to the backend — the glide fires per animation frame, the backend doesn't need frame-rate updates. */
const POSITION_STREAM_INTERVAL_MS = 400;

interface TransitOptions {
  start: [number, number];
  target: [number, number];
  /** Checked between phases and per tick — true aborts the whole transit (e.g. the task was cleared). */
  isCancelled: () => boolean;
  /** Route drawn so far + the unit's live position; the store turns this into state. */
  onTick: (update: { route?: [number, number][]; unitPos: [number, number] }) => void;
  /** Backend task id, once the fire-and-forget assign() POST has resolved — read per tick since it can land mid-glide. */
  getBackendId: () => string | undefined;
}

/**
 * The visual half of a dispatch, extracted from useTasksStore.assign() so
 * the store reads as orchestration: fetch a road route (OSRM, bezier
 * fallback), trace it in (~900ms reveal), then glide the unit along it,
 * streaming throttled positions to `POST /tasks/:id/position` during
 * transit. Resolves `true` when the unit arrives, `false` if cancelled.
 */
export async function driveTransitAnimation({
  start,
  target,
  isCancelled,
  onTick,
  getBackendId,
}: TransitOptions): Promise<boolean> {
  let route: [number, number][];
  try {
    route = (await fetchRoadRoute(start, target)) ?? buildFallbackRoute(start, target);
  } catch (err) {
    console.warn("[tasks] Route fetch threw unexpectedly, using fallback curve:", err);
    route = buildFallbackRoute(start, target);
  }
  if (isCancelled()) return false;

  await animateRouteReveal(
    route,
    900,
    (partial) => {
      if (isCancelled()) return;
      onTick({ route: partial, unitPos: partial[partial.length - 1] });
    },
    isCancelled,
  );
  if (isCancelled()) return false;

  const durationMs = simulatedTravelDurationMs(route);

  let lastPositionSentAt = 0;
  await animateAlongRoute(
    route,
    durationMs,
    (pos) => {
      if (isCancelled()) return;
      onTick({ unitPos: pos });

      const backendId = getBackendId();
      const now = performance.now();
      if (backendId && now - lastPositionSentAt > POSITION_STREAM_INTERVAL_MS) {
        lastPositionSentAt = now;
        tasksApi
          .updatePosition(backendId, pos[0], pos[1])
          .catch((err) => console.warn("[tasks] Failed to stream position:", err));
      }
    },
    isCancelled,
  );
  return !isCancelled();
}
