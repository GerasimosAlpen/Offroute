import { describe, expect, it } from "vitest";
import {
  metersBetween,
  routeBlockedBy,
  routeLengthMeters,
  sliceRouteByProgress,
} from "@/lib/routing";

// Jakarta, where the app's demo data sits. One degree of latitude is ~111.32 km
// everywhere; one degree of longitude shrinks by cos(latitude).
const JAKARTA: [number, number] = [-6.1818, 106.8223];

describe("metersBetween", () => {
  it("returns zero for the same point", () => {
    expect(metersBetween(JAKARTA, JAKARTA)).toBe(0);
  });

  it("converts a degree of latitude to about 111 km", () => {
    const d = metersBetween([0, 0], [1, 0]);
    expect(d).toBeCloseTo(111_320, 0);
  });

  it("narrows longitude by cos(latitude)", () => {
    // At 60°N a degree of longitude is about half its equatorial width.
    const atEquator = metersBetween([0, 0], [0, 1]);
    const atSixty = metersBetween([60, 0], [60, 1]);
    expect(atSixty / atEquator).toBeCloseTo(0.5, 2);
  });

  it("is symmetric to within the error of its own approximation", () => {
    // Not exactly symmetric by construction: the longitude term is scaled by
    // cos() of the FIRST argument's latitude only, so swapping the arguments
    // shifts the result slightly. Over 1.5 km that is ~1.5 cm — irrelevant at
    // the scale this is used, but worth pinning so a real regression (a sign
    // flip, a wrong axis) still fails here.
    const a: [number, number] = [-6.18, 106.82];
    const b: [number, number] = [-6.19, 106.83];
    expect(metersBetween(a, b)).toBeCloseTo(metersBetween(b, a), 1);
  });
});

describe("routeLengthMeters", () => {
  it("is zero for an empty or single-point route", () => {
    expect(routeLengthMeters([])).toBe(0);
    expect(routeLengthMeters([JAKARTA])).toBe(0);
  });

  it("sums consecutive segments", () => {
    const route: [number, number][] = [[0, 0], [1, 0], [2, 0]];
    expect(routeLengthMeters(route)).toBeCloseTo(2 * 111_320, 0);
  });

  it("measures path length, not straight-line displacement", () => {
    // A detour out and back is longer than the zero-distance endpoints suggest.
    const detour: [number, number][] = [[0, 0], [1, 0], [0, 0]];
    expect(routeLengthMeters(detour)).toBeCloseTo(2 * 111_320, 0);
  });
});

describe("routeBlockedBy", () => {
  // This decides whether an evacuation route is offered to a citizen at all,
  // so both directions of the check matter.
  const route: [number, number][] = [
    [-6.1818, 106.8223],
    [-6.1828, 106.8223],
    [-6.1838, 106.8223],
  ];

  it("is false when there are no blockers", () => {
    expect(routeBlockedBy(route, [])).toBe(false);
  });

  it("is false when a blocker is comfortably off the route", () => {
    // ~1.1 km away, far outside the 60 m default threshold.
    expect(routeBlockedBy(route, [[-6.1918, 106.8223]])).toBe(false);
  });

  it("is true when a blocker sits on a route point", () => {
    expect(routeBlockedBy(route, [[-6.1828, 106.8223]])).toBe(true);
  });

  it("respects a custom threshold", () => {
    // Offset in longitude, not latitude: the route points are themselves
    // 0.001 apart in latitude, so a latitude offset would land exactly on a
    // neighbouring point. 0.001 of longitude at 6°S is ~110 m — outside the
    // 60 m default, inside a 200 m threshold.
    const nearby: [number, number][] = [[-6.1828, 106.8223 + 0.001]];
    expect(routeBlockedBy(route, nearby, 60)).toBe(false);
    expect(routeBlockedBy(route, nearby, 200)).toBe(true);
  });

  it("is true if any one of several blockers matches", () => {
    const blockers: [number, number][] = [
      [-6.5, 106.8],
      [-6.1838, 106.8223],
    ];
    expect(routeBlockedBy(route, blockers)).toBe(true);
  });
});

describe("sliceRouteByProgress", () => {
  const route: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];

  it("returns the origin at zero progress", () => {
    const sliced = sliceRouteByProgress(route, 0);
    expect(sliced[0]).toEqual([0, 0]);
  });

  it("returns the whole route at full progress", () => {
    const sliced = sliceRouteByProgress(route, 1);
    expect(sliced[sliced.length - 1]).toEqual([3, 0]);
  });

  it("grows monotonically with progress", () => {
    const quarter = routeLengthMeters(sliceRouteByProgress(route, 0.25));
    const half = routeLengthMeters(sliceRouteByProgress(route, 0.5));
    const full = routeLengthMeters(sliceRouteByProgress(route, 1));
    expect(quarter).toBeLessThanOrEqual(half);
    expect(half).toBeLessThanOrEqual(full);
  });
});
