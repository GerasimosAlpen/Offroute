import { isTauri } from "@/lib/tauri";

let audioCtx: AudioContext | null = null;

/** A short two-tone beep via Web Audio — no asset file, works in both the browser and the Tauri webview. */
function beep() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.setValueAtTime(0.001, now + i * 0.16);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.16 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.15);
    });
  } catch (err) {
    console.warn("[alerts] Failed to play alert tone:", err);
  }
}

let notificationPermissionChecked = false;

async function notifyNative(title: string, body: string) {
  if (!isTauri) return;
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
    if (!notificationPermissionChecked) {
      notificationPermissionChecked = true;
      if (!(await isPermissionGranted())) await requestPermission();
    }
    if (await isPermissionGranted()) sendNotification({ title, body });
  } catch (err) {
    console.warn("[alerts] Failed to send native notification:", err);
  }
}

/**
 * Fires for events that need the operator's attention even if they're not
 * currently looking at the relevant panel — a critical incident, a new evac
 * request, or a unit going silent. Sound is universal (browser + Tauri);
 * the native OS notification only fires inside the real desktop app.
 */
export function raiseAlert(title: string, body: string) {
  beep();
  void notifyNative(title, body);
}
