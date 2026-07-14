import type { WindowRect } from "./useWindowLayout";

/** Distance in pixels from a desktop-container edge that triggers a Windows-Snap-style zone. */
export const SNAP_EDGE_PX = 32;

export const MIN_W_FRAC = 0.18;
export const MIN_H_FRAC = 0.18;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Windows-Snap-style zone detection: drag to a corner → quarter tile, drag
 * to a side edge → half, drag to the top edge → maximize. Returns null (no
 * snap) once the cursor is away from every edge.
 */
export function computeSnapZone(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
): WindowRect | null {
  const nearLeft = clientX - containerRect.left < SNAP_EDGE_PX;
  const nearRight = containerRect.right - clientX < SNAP_EDGE_PX;
  const nearTop = clientY - containerRect.top < SNAP_EDGE_PX;
  const nearBottom = containerRect.bottom - clientY < SNAP_EDGE_PX;

  if (nearTop && nearLeft) return { x: 0, y: 0, w: 0.5, h: 0.5 };
  if (nearTop && nearRight) return { x: 0.5, y: 0, w: 0.5, h: 0.5 };
  if (nearBottom && nearLeft) return { x: 0, y: 0.5, w: 0.5, h: 0.5 };
  if (nearBottom && nearRight) return { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
  if (nearTop) return { x: 0, y: 0, w: 1, h: 1 };
  if (nearLeft) return { x: 0, y: 0, w: 0.5, h: 1 };
  if (nearRight) return { x: 0.5, y: 0, w: 0.5, h: 1 };
  return null;
}
