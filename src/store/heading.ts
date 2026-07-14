import { create } from "zustand";

interface HeadingState {
  /** Compass heading in degrees clockwise from north, or null if no fix yet / unsupported. */
  heading: number | null;
  /** Whether this device/webview actually exposes usable orientation data — feature-detected, never assumed. */
  available: boolean;
  /** Set once we've asked (and, on iOS, the user has answered) the motion-permission prompt. */
  requested: boolean;
}

export const useHeadingStore = create<HeadingState>(() => ({
  heading: null,
  available: false,
  requested: false,
}));

let started = false;
let lastEmit = 0;

function extractHeading(event: DeviceOrientationEvent): number | null {
  // iOS Safari/WKWebView exposes true compass heading directly.
  const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  if (typeof webkitHeading === "number" && !Number.isNaN(webkitHeading)) return webkitHeading;

  // Android's `absolute` alpha is degrees counter-clockwise from north — flip to clockwise.
  if (event.absolute && typeof event.alpha === "number") return (360 - event.alpha) % 360;

  return null;
}

function handleOrientation(event: DeviceOrientationEvent) {
  const heading = extractHeading(event);
  if (heading === null) return;

  // Sensor events can fire dozens of times a second — throttle so map
  // rotation reads as a smooth compass, not a jittery re-render storm.
  const now = performance.now();
  if (now - lastEmit < 120) return;
  lastEmit = now;

  useHeadingStore.setState({ heading, available: true });
}

/**
 * Best-effort device compass, feature-detected — there is no dedicated Tauri
 * compass/magnetometer plugin (see AGENTS.md's plugin table: only
 * `tauri-plugin-os` exists, for platform info, not sensors), and Tauri's
 * webview is otherwise a plain OS webview, so this relies on the standard
 * web `DeviceOrientationEvent` API working through whatever webview the app
 * runs in (WKWebView on iOS/macOS commonly does; WebView2/WebKitGTK on
 * Windows/Linux typically don't expose a compass at all). Never assume it
 * works — always check `available` before rotating anything, and degrade to
 * a plain north-up map when it doesn't.
 *
 * Must be started from a real user gesture (a tap) on iOS 13+, where
 * `DeviceOrientationEvent.requestPermission()` requires one — call
 * `startHeadingWatch()` from a click handler, not on mount.
 */
export async function startHeadingWatch() {
  if (started) return;
  started = true;

  if (typeof DeviceOrientationEvent === "undefined") return;

  const maybeRequestPermission = (DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  }).requestPermission;

  if (typeof maybeRequestPermission === "function") {
    try {
      const result = await maybeRequestPermission();
      useHeadingStore.setState({ requested: true });
      if (result !== "granted") return;
    } catch {
      useHeadingStore.setState({ requested: true });
      return;
    }
  } else {
    useHeadingStore.setState({ requested: true });
  }

  window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
  window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
}

/** Reads the shared heading state. Call `startHeadingWatch()` from a tap to actually start it. */
export function useDeviceHeading(): HeadingState {
  return useHeadingStore();
}
