import { Palette } from "lucide-preact";
import { Card } from "./Card";

export function TailwindCard() {
  return (
    <Card
      icon={<Palette size={14} />}
      title="Tailwind CSS v4"
      badge="vite plugin"
      badgeColor="text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
      delay={0.45}
    >
      <p class="text-xs text-zinc-500">Zero-runtime utility CSS via Vite plugin — no PostCSS.</p>
      <div class="flex gap-1.5 flex-wrap">
        {["bg-indigo-500", "bg-sky-500", "bg-teal-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-pink-500", "bg-violet-500"].map(
          (c) => (
            <div key={c} class={`w-7 h-7 rounded-lg ${c}`} title={c} />
          ),
        )}
      </div>
      <div class="flex gap-2 flex-wrap">
        <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 animate-pulse">pulse</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 animate-bounce">bounce</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 animate-spin">spin</span>
      </div>
    </Card>
  );
}
