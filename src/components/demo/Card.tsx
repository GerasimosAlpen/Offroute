import { motion } from "framer-motion";
import { isTauri } from "@/lib/tauri";
import { Badge } from "./Badge";

export function Card({
  icon,
  title,
  badge,
  badgeColor,
  tauriOnly = false,
  children,
  delay = 0,
}: {
  icon: preact.ComponentChildren;
  title: string;
  badge: string;
  badgeColor: string;
  tauriOnly?: boolean;
  children: preact.ComponentChildren;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">{icon}</div>
          <span class="text-sm font-semibold text-white">{title}</span>
        </div>
        <div class="flex items-center gap-1.5">
          {tauriOnly && !isTauri && (
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full border text-zinc-500 border-zinc-700 bg-zinc-800">
              offline
            </span>
          )}
          <Badge label={badge} color={badgeColor} />
        </div>
      </div>
      {children}
    </motion.div>
  );
}
