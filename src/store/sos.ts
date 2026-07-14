import { create } from "zustand";
import { victimsApi, type SosPingDto } from "@/lib/api";

const DEVICE_ID_KEY = "offroute.sos.deviceId";
const PENDING_KEY = "offroute.sos.pending";
const RETRY_MS = 10_000;

/** Stable per-device id so repeated pings from the same phone update one victim record instead of creating a new one each time. */
export function getSosDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getPending(): SosPingDto | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setPending(dto: SosPingDto | null) {
  try {
    if (dto) localStorage.setItem(PENDING_KEY, JSON.stringify(dto));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // localStorage unavailable — nothing more we can do locally, next send attempt will just retry from scratch
  }
}

export type SosSendState = "idle" | "sending" | "sent" | "queued";

interface SosStoreState {
  sendState: SosSendState;
  lastSentAt: number | null;
  send: (lat: number, lon: number, label?: string) => Promise<void>;
}

/**
 * Real-world disaster networks are often *intermittent*, not permanently
 * dead — cell towers flicker back briefly, wifi comes and goes. This store
 * doesn't need true zero-connectivity relay (that needs a physical channel:
 * BLE mesh via a native peripheral role, or satellite hardware — no web
 * trick substitutes for a missing radio link, see TODO.md's Bluetooth
 * Tier 2 notes). What it *can* honestly do is make sure a brief connectivity
 * window is enough: a failed send is kept as the one pending ping (old
 * positions are superseded, not queued as history) and retried on a timer
 * and on the browser's `online` event, so the moment signal returns the
 * position gets through without the user having to do anything.
 */
export const useSosStore = create<SosStoreState>((set) => {
  let retryTimer: ReturnType<typeof setInterval> | null = null;

  const attemptSend = async (dto: SosPingDto) => {
    try {
      await victimsApi.sos(dto);
      setPending(null);
      set({ sendState: "sent", lastSentAt: Date.now() });
    } catch (err) {
      console.warn("[sos] Failed to send SOS ping, will retry:", err);
      setPending(dto);
      set({ sendState: "queued" });
    }
  };

  const startRetryLoop = () => {
    if (retryTimer) return;
    retryTimer = setInterval(() => {
      const pending = getPending();
      if (pending) void attemptSend(pending);
    }, RETRY_MS);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      const pending = getPending();
      if (pending) void attemptSend(pending);
    });
    startRetryLoop();
    // Resume any ping that failed before the last reload
    const stranded = getPending();
    if (stranded) void attemptSend(stranded);
  }

  return {
    sendState: "idle",
    lastSentAt: null,
    send: async (lat, lon, label) => {
      set({ sendState: "sending" });
      const dto: SosPingDto = { id: getSosDeviceId(), lat, lon, label };
      await attemptSend(dto);
    },
  };
});
