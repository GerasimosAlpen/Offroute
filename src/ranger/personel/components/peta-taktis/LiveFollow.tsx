import { useEffect } from "preact/hooks";
import { useMap } from "react-leaflet";

/** While actively navigating, keeps the camera gently centered on the crew's live GPS fix as it updates — so the dot moving is something you can actually see happening, not something you have to go look for. */
export function LiveFollow({ pos, active }: { pos: [number, number]; active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    map.panTo(pos, { animate: true, duration: 0.8, easeLinearity: 0.25 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos[0], pos[1], active]);
  return null;
}
