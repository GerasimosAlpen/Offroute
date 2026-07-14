import { motion } from "framer-motion";
import { Wifi, WifiOff, MapPin } from "lucide-preact";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useDeviceLocation } from "@/store/location";

/**
 * Animated status header showing connection state with a pulsing indicator
 * and the user's current location — lives at the top of every user page.
 */
export function StatusHeader() {
  const online = useOnlineStatus();
  const location = useDeviceLocation();

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#444] shrink-0">
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          {online ? (
            <Wifi size={16} className="text-[#66df75]" />
          ) : (
            <WifiOff size={16} className="text-[#ff8fa3]" />
          )}
          <motion.span
            className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${
              online ? "bg-[#66df75]" : "bg-[#FF0040]"
            }`}
            animate={
              online
                ? { opacity: [1, 0.35, 1] }
                : { opacity: 1 }
            }
            transition={
              online
                ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0 }
            }
          />
        </div>
        <span
          className={`font-mono text-[11px] tracking-wider ${
            online ? "text-[#66df75]" : "text-[#ff8fa3]"
          }`}
        >
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 min-w-0 max-w-[55%]">
        <MapPin size={12} className="text-[#e1bec2] shrink-0" />
        <motion.span
          key={location.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[10px] text-[#e1bec2] truncate"
        >
          {location.label}
        </motion.span>
      </div>
    </div>
  );
}
