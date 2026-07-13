import { Wifi, WifiOff } from "lucide-preact";
import { motion, AnimatePresence } from "framer-motion";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

export function ConnectionStatus({ collapsed }: { collapsed: boolean }) {
  const online = useOnlineStatus();
  const Icon = online ? Wifi : WifiOff;

  return (
    <div
      title={online ? "Online" : "Offline"}
      className={`flex items-center gap-3 w-full py-4 font-mono font-medium text-sm tracking-[0.7px] whitespace-nowrap select-none ${
        online ? "text-[#e1bec2]" : "text-[#ff8fa3]"
      } ${collapsed ? "justify-center px-0" : "pl-7 pr-6"}`}
    >
      <span className="relative flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={2} />
        <motion.span
          className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${
            online ? "bg-[#3ddc59]" : "bg-[#ff0040]"
          }`}
          animate={online ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
          transition={
            online
              ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
        />
      </span>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {online ? "Online" : "Offline"}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
