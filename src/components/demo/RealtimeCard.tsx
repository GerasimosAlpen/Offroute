import { invoke } from "@tauri-apps/api/core";
import { Waves } from "lucide-preact";
import { isTauri } from "@/lib/tauri";
import { useTauriEvent } from "@/lib/useTauriEvent";
import { Card } from "./Card";
import { primaryBtn } from "./styles";

type DeviceStatusPayload = { status: string; ts: number };

export function RealtimeCard() {
  const event = useTauriEvent<DeviceStatusPayload>(
    "device://status",
    isTauri ? null : { status: "ok", ts: Date.now() },
  );

  async function fire() {
    if (!isTauri) return;
    await invoke("emit_test_event");
  }

  return (
    <Card
      icon={<Waves size={14} />}
      title="Realtime (Tauri events)"
      badge="device channel"
      badgeColor="text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10"
      tauriOnly
      delay={0.6}
    >
      <p class="text-xs text-zinc-500">
        Generic Tauri event channel — <code class="text-zinc-400">useTauriEvent</code> listens,
        Rust emits. This is how ranger will get realtime device data.
      </p>
      <button class={primaryBtn} onClick={fire}>
        Emit test event
      </button>
      {event && (
        <pre class="text-xs font-mono text-fuchsia-300 bg-zinc-800 rounded-lg p-2 overflow-auto">
          {JSON.stringify(event, null, 2)}
          {!isTauri && "  [mock]"}
        </pre>
      )}
    </Card>
  );
}
