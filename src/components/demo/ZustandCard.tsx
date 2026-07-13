import { Layers } from "lucide-preact";
import { useDemoStore } from "@/store/demo";
import { Card } from "./Card";
import { btn, ghostBtn } from "./styles";

export function ZustandCard() {
  const { count, messages, increment, decrement, reset, push } = useDemoStore();

  return (
    <Card
      icon={<Layers size={14} />}
      title="Zustand"
      badge="v5"
      badgeColor="text-orange-400 border-orange-500/30 bg-orange-500/10"
      delay={0.2}
    >
      <p class="text-xs text-zinc-500">Global state — no context boilerplate.</p>
      <div class="flex items-center gap-3">
        <button class={ghostBtn} onClick={decrement}>−</button>
        <span class="text-2xl font-bold text-white w-10 text-center tabular-nums">{count}</span>
        <button class={ghostBtn} onClick={increment}>+</button>
        <button class={`${btn} ml-auto text-zinc-500 hover:text-zinc-300`} onClick={reset}>reset</button>
      </div>
      <button
        class={ghostBtn}
        onClick={() => push(`event at ${new Date().toLocaleTimeString()}`)}
      >
        Push message
      </button>
      {messages.length > 0 && (
        <ul class="space-y-1">
          {messages.map((m, i) => (
            <li key={i} class="text-xs font-mono text-zinc-500 truncate">{m}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
