import { useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { Zap } from "lucide-preact";
import { isTauri } from "@/lib/tauri";
import { Card } from "./Card";
import { primaryBtn } from "./styles";

export function TauriCard() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(
    isTauri ? null : "Hello, world aku sontoloyo  [mock]",
  );

  async function run() {
    if (!isTauri) {
      setResult(`Hello, ${name || "world"} aku sontoloyo  [mock]`);
      return;
    }
    const res = await invoke<string>("greet", { name: name || "world" });
    setResult(res);
  }

  return (
    <Card
      icon={<Zap size={14} />}
      title="Tauri IPC"
      badge="invoke"
      badgeColor="text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
      tauriOnly
      delay={0}
    >
      <p class="text-xs text-zinc-500">Call Rust commands from Preact.</p>
      <div class="flex gap-2">
        <input
          class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
          placeholder="your name"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button class={primaryBtn} onClick={run}>
          Invoke
        </button>
      </div>
      {result && (
        <p class="text-xs text-emerald-400 font-mono bg-zinc-800 rounded-lg px-3 py-2 truncate">
          {result}
        </p>
      )}
    </Card>
  );
}
