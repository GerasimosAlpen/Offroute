import { describe, expect, it } from "vitest";
import { formatCoords, formatDistance, formatRelativeAge } from "@/lib/format";

describe("formatCoords", () => {
  it("labels hemispheres from the sign of each value", () => {
    // Jakarta: south of the equator, east of Greenwich.
    expect(formatCoords(-6.1818, 106.8223)).toBe("6.1818°S 106.8223°E");
  });

  it("handles all four quadrants", () => {
    expect(formatCoords(40.7128, -74.006)).toBe("40.7128°N 74.0060°W");
    expect(formatCoords(-33.8688, 151.2093)).toBe("33.8688°S 151.2093°E");
  });

  it("treats the equator and prime meridian as positive", () => {
    expect(formatCoords(0, 0)).toBe("0.0000°N 0.0000°E");
  });

  it("always emits four decimal places — roughly 11 m of precision", () => {
    expect(formatCoords(-6.1, 106.8)).toBe("6.1000°S 106.8000°E");
  });
});

describe("formatRelativeAge", () => {
  const now = 1_700_000_000_000;

  it("reports seconds below a minute", () => {
    expect(formatRelativeAge(now - 42_000, now)).toBe("42 detik lalu");
  });

  it("switches to minutes at exactly 60 seconds", () => {
    expect(formatRelativeAge(now - 59_000, now)).toBe("59 detik lalu");
    expect(formatRelativeAge(now - 60_000, now)).toBe("1 menit lalu");
  });

  it("floors partial minutes rather than rounding up", () => {
    // 3m59s must not read as "4 menit lalu" — in dispatch, overstating how
    // stale a report is changes the operator's decision.
    expect(formatRelativeAge(now - 239_000, now)).toBe("3 menit lalu");
  });

  it("reads zero for a timestamp of right now", () => {
    expect(formatRelativeAge(now, now)).toBe("0 detik lalu");
  });
});

describe("formatDistance", () => {
  it("uses whole meters below 1 km", () => {
    expect(formatDistance(340)).toBe("340 m");
    expect(formatDistance(340.6)).toBe("341 m");
  });

  it("switches to kilometres at exactly 1000 m", () => {
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(1000)).toBe("1.0 km");
  });

  it("shows one decimal place for kilometres", () => {
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(15_800)).toBe("15.8 km");
  });

  it("handles zero", () => {
    expect(formatDistance(0)).toBe("0 m");
  });
});
