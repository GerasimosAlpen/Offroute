import { useState } from "preact/hooks";
import { motion } from "framer-motion";
import { Wind } from "lucide-preact";
import { Card } from "./Card";
import { btn } from "./styles";

export function FramerCard() {
  const [active, setActive] = useState(false);

  return (
    <Card
      icon={<Wind size={14} />}
      title="Framer Motion"
      badge="animation"
      badgeColor="text-pink-400 border-pink-500/30 bg-pink-500/10"
      delay={0.4}
    >
      <p class="text-xs text-zinc-500">Production-ready animations and gestures.</p>
      <div class="flex items-center gap-4">
        <motion.div
          animate={{
            scale: active ? 1.4 : 1,
            rotate: active ? 180 : 0,
            backgroundColor: active ? "#ec4899" : "#3f3f46",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          class="w-10 h-10 rounded-xl"
        />
        <motion.div
          animate={{ x: active ? 60 : 0, opacity: active ? 1 : 0.4 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          class="w-3 h-3 rounded-full bg-pink-500"
        />
        <button
          class={`${btn} ml-auto bg-pink-700 hover:bg-pink-600 text-white`}
          onClick={() => setActive((v) => !v)}
        >
          {active ? "Reset" : "Animate"}
        </button>
      </div>
    </Card>
  );
}
