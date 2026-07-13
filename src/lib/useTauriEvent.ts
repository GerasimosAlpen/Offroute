import { useEffect, useState } from "preact/hooks";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "./tauri";

/**
 * Subscribes to a Tauri event and returns the latest payload. Tauri is the
 * IPC boundary to the OS/device — anything reporting realtime state from the
 * Rust side (hardware polling, a background WS bridge, sensor reads) should
 * emit here, and this hook is how the UI picks it up. No-ops outside Tauri.
 */
export function useTauriEvent<T>(eventName: string, initial: T | null = null) {
  const [payload, setPayload] = useState<T | null>(initial);

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen<T>(eventName, (event) => {
      if (!cancelled) setPayload(event.payload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [eventName]);

  return payload;
}
