import { useEffect, useRef } from "preact/hooks";
import { useCommsLogStore } from "@/store/commsLog";

/**
 * Shared plumbing for every comms-log surface (radar's CommsLogPanel,
 * personel's Komunikasi): history hydration on first mount, plus the
 * baseline marker separating hydrated history from live entries — only
 * entries appended *after* the baseline (self-sent, or arriving live from
 * another client) play the encrypt/decrypt reveal; history renders plainly
 * instead of flash-decrypting the moment the surface opens.
 *
 * Scroll-to-end stays in each component — they scroll on different lists
 * (radar scrolls the full log, Komunikasi its contact-filtered view).
 */
export function useCommsLog() {
  const entries = useCommsLogStore((s) => s.entries);
  const loaded = useCommsLogStore((s) => s.loaded);
  const append = useCommsLogStore((s) => s.append);
  const loadHistory = useCommsLogStore((s) => s.loadHistory);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const baselineCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (loaded && baselineCountRef.current === null) {
      baselineCountRef.current = useCommsLogStore.getState().entries.length;
    }
  }, [loaded]);

  return { entries, loaded, append, baselineCountRef };
}
