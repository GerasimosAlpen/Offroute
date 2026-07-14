import { useEffect } from "preact/hooks";
import { useMap } from "react-leaflet";
import { wait } from "./utils";

/**
 * Runs once, the first time a real GPS fix lands — always establishes the
 * crew's actual starting point first (zoom out to orient, then a smooth
 * push-in), instead of the map just silently appearing already zoomed in on
 * a coordinate with no context for where that even is.
 */
export function IntroSequence({ startPos }: { startPos: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      map.setView(startPos, 12, { animate: false });
      await wait(500);
      if (cancelled) return;
      map.flyTo(startPos, 16, { duration: 1.6, easeLinearity: 0.15 });
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
