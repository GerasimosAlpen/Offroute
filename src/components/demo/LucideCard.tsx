import { motion } from "framer-motion";
import {
  Zap,
  Bell,
  Database as DbIcon,
  Lock,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wind,
  Palette,
} from "lucide-preact";
import { Card } from "./Card";

export function LucideCard() {
  const icons = [
    Zap, Bell, DbIcon, Lock, Layers, RefreshCw,
    ShieldCheck, Sparkles, Wind, Palette,
  ];

  return (
    <Card
      icon={<Sparkles size={14} />}
      title="Lucide Icons"
      badge="lucide-preact"
      badgeColor="text-zinc-400 border-zinc-600 bg-zinc-800"
      delay={0.5}
    >
      <p class="text-xs text-zinc-500">5000+ icons, tree-shakeable, Preact native.</p>
      <div class="flex gap-3 flex-wrap">
        {icons.map((Icon, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.3, color: "#818cf8" }}
            class="text-zinc-400 cursor-default"
          >
            <Icon size={18} />
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
