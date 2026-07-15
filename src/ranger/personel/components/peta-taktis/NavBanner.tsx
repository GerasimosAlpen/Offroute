import { motion } from "framer-motion";
import { Navigation, X } from "lucide-preact";

interface NavBannerProps {
  color: string;
  routeInfo: { distanceKm: number; timeMin: number } | null;
  onClear: () => void;
}

/** "NAVIGASI AKTIF" strip shown once a route is resolved and being followed. */
export function NavBanner({ color, routeInfo, onClear }: NavBannerProps) {
  return (
    <motion.div
      key="active"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div
        className="px-4 py-2 flex items-center justify-between border-b"
        style={{ background: `${color}15`, borderColor: color }}
      >
        <div className="flex items-center gap-2">
          <Navigation size={12} style={{ color } as any} />
          <span className="font-mono text-[10px] font-bold" style={{ color }}>
            NAVIGASI AKTIF
          </span>
          {routeInfo && (
            <span className="font-mono text-[9px] text-[#555]">
              {routeInfo.timeMin} mnt · {routeInfo.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>
        <button onClick={onClear} className="text-[#555] hover:text-[#e1bec2]">
          <X size={12} />
        </button>
      </div>
    </motion.div>
  );
}
