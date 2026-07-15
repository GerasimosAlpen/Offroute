import { useEffect } from "preact/hooks";
import { create } from "zustand";
import { socket } from "@/lib/socket";
import type { Ranger } from "@/lib/rangers";
import { useLocationStore } from "./location";
import { reportRemoteRangerPosition } from "./tasks";
import { useDutyStatusStore, type DutyStatus } from "./dutyStatus";

export interface PresenceEntry {
  rangerId: string;
  name: string;
  callsign: string;
  lastSeen: number;
  dutyStatus: DutyStatus;
  /** Live GPS position, when the unit's device has a fix — realtime cross-device tracking rides on the same heartbeat as presence. */
  lat?: number;
  lon?: number;
}

interface PresenceState {
  /** Keyed by rangerId — deduped even if the backend briefly holds two socket entries for the same ranger (e.g. a reload before the old socket disconnects). */
  units: Record<string, PresenceEntry>;
}

/**
 * Who's actually online right now — not a static roster, a live signal.
 * Personel heartbeats every `HEARTBEAT_MS` (see `usePresenceHeartbeat`);
 * radar reads this to flag a unit that's disconnected or gone quiet, which
 * is the whole point: knowing someone dropped off is a safety signal, not
 * just a UI nicety.
 */
export const usePresenceStore = create<PresenceState>((set) => {
  socket.on("presence-update", (entries: PresenceEntry[]) => {
    if (!Array.isArray(entries)) return; // malformed payload, ignore rather than throw
    const units: Record<string, PresenceEntry> = {};
    for (const entry of entries) {
      if (!entry || typeof entry.rangerId !== "string") continue;
      const existing = units[entry.rangerId];
      if (!existing || existing.lastSeen < entry.lastSeen) units[entry.rangerId] = entry;
    }
    set({ units });

    // Feed live device positions into the single shared "where is ranger X"
    // state (src/store/tasks.ts) so dispatch math and every map layer track
    // the real device, not a static home offset. Guarded inside — a position
    // this tab is itself animating (its own dispatch glide) is never
    // overwritten by the slower heartbeat echo.
    for (const entry of Object.values(units)) {
      if (typeof entry.lat === "number" && typeof entry.lon === "number") {
        reportRemoteRangerPosition(entry.rangerId, [entry.lat, entry.lon]);
      }
    }
  });

  return { units: {} };
});

const HEARTBEAT_MS = 20_000;

/**
 * Called once from personel's app shell — pings presence immediately on
 * mount, then every `HEARTBEAT_MS` while the tab/app stays open. Stops
 * automatically on unmount (tab close, navigation away); radar then sees
 * this unit go stale once its `lastSeen` falls behind, and drops it
 * entirely once the socket itself disconnects.
 */
/** Floor between position-triggered heartbeats — GPS can tick fast; presence doesn't need frame-rate updates, just honest realtime. */
const POSITION_PING_MIN_MS = 3_000;

export function usePresenceHeartbeat(self: Ranger) {
  const dutyStatus = useDutyStatusStore((s) => s.status);

  useEffect(() => {
    const send = () => {
      const coords = useLocationStore.getState().coords;
      socket.emit("presence-heartbeat", {
        rangerId: self.id,
        name: self.name,
        callsign: self.callsign,
        dutyStatus: useDutyStatusStore.getState().status,
        // Live GPS rides along when available — this is what lets radar (and
        // every other device) track this unit's real position in realtime.
        ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      });
    };
    send();
    const timer = setInterval(send, HEARTBEAT_MS);

    // Don't wait up to 20s to share a fresh GPS fix — ping on movement too,
    // throttled so a jittery GPS doesn't spam the socket.
    let lastPositionPing = 0;
    const unsubscribe = useLocationStore.subscribe((state, prev) => {
      if (!state.coords || state.coords === prev.coords) return;
      const now = Date.now();
      if (now - lastPositionPing < POSITION_PING_MIN_MS) return;
      lastPositionPing = now;
      send();
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.id, self.name, self.callsign, dutyStatus]);
}
