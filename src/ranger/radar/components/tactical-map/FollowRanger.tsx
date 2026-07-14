import { useEffect } from "preact/hooks";
import { useMap } from "react-leaflet";

/** Pans to follow the ranger's position — paused while a FLARE sequence is directing the camera itself. */
export function FollowRanger({ lat, lon, enabled }: { lat: number; lon: number; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) map.panTo([lat, lon]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, enabled]);
  return null;
}
