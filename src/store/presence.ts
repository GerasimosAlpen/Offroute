import { useEffect } from "preact/hooks";
import { create } from "zustand";
import { socket } from "@/lib/socket";
import type { Ranger } from "@/lib/rangers";
import { useDutyStatusStore, type DutyStatus } from "./dutyStatus";

export interface PresenceEntry {
  rangerId: string;
  name: string;
  callsign: string;
  lastSeen: number;
  dutyStatus: DutyStatus;
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
export function usePresenceHeartbeat(self: Ranger) {
  const dutyStatus = useDutyStatusStore((s) => s.status);

  useEffect(() => {
    const send = () =>
      socket.emit("presence-heartbeat", {
        rangerId: self.id,
        name: self.name,
        callsign: self.callsign,
        dutyStatus: useDutyStatusStore.getState().status,
      });
    send();
    const timer = setInterval(send, HEARTBEAT_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.id, self.name, self.callsign, dutyStatus]);
}
