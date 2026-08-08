/** Flat-earth approximation — fine at the sub-kilometer scale these mock offsets live at. */
import { OSRM_ENDPOINT } from "./config";

export function metersBetween(a: [number, number], b: [number, number]) {
  const latM = (a[0] - b[0]) * 111_320;
  const lonM = (a[1] - b[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(latM ** 2 + lonM ** 2);
}

export function routeLengthMeters(points: [number, number][]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += metersBetween(points[i - 1], points[i]);
  return total;
}

/** Whether a route passes near any known blocker (e.g. a blocked-road hazard) — so "which route is actually available" is a real check, not just "which is shortest." */
export function routeBlockedBy(
  route: [number, number][],
  blockers: [number, number][],
  thresholdMeters = 60,
): boolean {
  return route.some((point) => blockers.some((blocker) => metersBetween(point, blocker) < thresholdMeters));
}

function cumulativeDistances(route: [number, number][]) {
  const cumulative: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cumulative.push(cumulative[i - 1] + metersBetween(route[i - 1], route[i]));
  }
  return cumulative;
}

// TODO(routing): OSRM_ENDPOINT (lib/config.ts) points at OSRM's public DEMO
// server — free,
// no key, real road-snapped routing, but rate-limited and explicitly "not
// suitable for production" per OSRM's own usage policy. Fine for a demo;
// self-host OSRM or move to a paid routing API (GraphHopper, Mapbox, etc.)
// before shipping. Also still fully online-only — the README's own
// deferred-pending-offline-decision routing phase (Dijkstra over a local
// node graph) is what would cover the offline case; this doesn't replace it.
export async function fetchRoadRoute(
  start: [number, number],
  end: [number, number],
): Promise<[number, number][] | null> {
  try {
    const url = `${OSRM_ENDPOINT}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    // OSRM returns [lon, lat] pairs — Leaflet wants [lat, lon].
    return coords.map(([lon, lat]: [number, number]) => [lat, lon] as [number, number]);
  } catch {
    return null;
  }
}

/**
 * Fallback for when OSRM is unreachable — bends a straight line into a
 * gentle curve so it isn't a perfectly artificial line, nothing more.
 * `bend` (fraction of the leg length, signed) controls how far and which
 * direction the curve bows — varying it is how the personel-side "route
 * search" visualization (`PetaTaktis.tsx`) draws a spread of distinct
 * candidate paths from the same start/end pair.
 */
export function buildFallbackRoute(
  start: [number, number],
  end: [number, number],
  steps = 40,
  bend = 0.18,
): [number, number][] {
  const midLat = (start[0] + end[0]) / 2;
  const midLon = (start[1] + end[1]) / 2;
  const dLat = end[0] - start[0];
  const dLon = end[1] - start[1];
  const bendLat = midLat + dLon * bend;
  const bendLon = midLon - dLat * bend;

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * bendLat + t ** 2 * end[0];
    const lon = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * bendLon + t ** 2 * end[1];
    points.push([lat, lon]);
  }
  return points;
}

/**
 * Animates continuously along a route by real elapsed time (rAF-driven),
 * interpolating between whichever two raw points straddle the current
 * distance — a true glide, not a jump between fixed ticks. `onTick` fires
 * every frame with the current position and progress fraction (0..1);
 * `shouldCancel` is checked every frame so an unmounted/cancelled caller can
 * stop the loop early.
 */
export function animateAlongRoute(
  route: [number, number][],
  durationMs: number,
  onTick: (pos: [number, number], t: number) => void,
  shouldCancel: () => boolean = () => false,
): Promise<void> {
  return new Promise((resolve) => {
    if (route.length < 2) {
      if (route.length === 1) onTick(route[0], 1);
      resolve();
      return;
    }

    const cumulative = cumulativeDistances(route);
    const total = cumulative[cumulative.length - 1] || 1;
    const start = performance.now();

    function tick(now: number) {
      if (shouldCancel()) {
        resolve();
        return;
      }

      const t = Math.min(1, (now - start) / durationMs);
      const targetDist = t * total;
      let idx = cumulative.findIndex((d) => d >= targetDist);
      if (idx <= 0) idx = 1;
      const segStart = cumulative[idx - 1];
      const segEnd = cumulative[idx];
      const segT = segEnd === segStart ? 0 : (targetDist - segStart) / (segEnd - segStart);
      const [lat1, lon1] = route[idx - 1];
      const [lat2, lon2] = route[idx];
      onTick([lat1 + (lat2 - lat1) * segT, lon1 + (lon2 - lon1) * segT], t);

      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }

    requestAnimationFrame(tick);
  });
}

/** Picks a demo-paced travel duration from route length — not real-world speed, tuned to feel right for a short drill. */
export function simulatedTravelDurationMs(route: [number, number][], minMs = 2500, maxMs = 7000) {
  const meters = routeLengthMeters(route);
  return Math.min(maxMs, Math.max(minMs, meters * 3));
}

/** The leading `t` fraction of a route, by distance — the partial line for a "drawing itself" reveal. */
export function sliceRouteByProgress(route: [number, number][], t: number): [number, number][] {
  if (route.length < 2) return route;
  if (t <= 0) return [route[0]];
  if (t >= 1) return route;

  const cumulative = cumulativeDistances(route);
  const total = cumulative[cumulative.length - 1] || 1;
  const targetDist = t * total;

  const result: [number, number][] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    if (cumulative[i] <= targetDist) {
      result.push(route[i]);
      continue;
    }
    const segStart = cumulative[i - 1];
    const segEnd = cumulative[i];
    const segT = segEnd === segStart ? 0 : (targetDist - segStart) / (segEnd - segStart);
    const [lat1, lon1] = route[i - 1];
    const [lat2, lon2] = route[i];
    result.push([lat1 + (lat2 - lat1) * segT, lon1 + (lon2 - lon1) * segT]);
    break;
  }
  return result;
}

/**
 * Draws a route progressively from start to end over `durationMs`, instead
 * of the line just appearing all at once — `onTick` fires every frame with
 * the partial route so far.
 */
export function animateRouteReveal(
  route: [number, number][],
  durationMs: number,
  onTick: (partialRoute: [number, number][]) => void,
  shouldCancel: () => boolean = () => false,
): Promise<void> {
  return new Promise((resolve) => {
    if (route.length < 2) {
      onTick(route);
      resolve();
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      if (shouldCancel()) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      onTick(sliceRouteByProgress(route, t));
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}
