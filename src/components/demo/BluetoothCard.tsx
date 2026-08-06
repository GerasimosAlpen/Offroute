import { Bluetooth } from "lucide-preact";
import { isTauri } from "@/lib/tauri";
import { useBluetoothStore } from "@/store/bluetooth";
import { Card } from "./Card";
import { primaryBtn, ghostBtn } from "./styles";

/**
 * Debug surface for the Tier 1 BLE relay (see src-tauri/src/commands/bluetooth.rs
 * and TODO.md's "Bluetooth — two tiers"). Central/client role only — lists
 * and talks to real nearby BLE peripherals (e.g. a phone in nRF Connect's
 * peripheral mode via NUS), not yet a second Offroute instance.
 */
export function BluetoothCard() {
  const { scanning, devices, messages, lastError, deviceErrors, startScan, stopScan, connect, sendMessage } = useBluetoothStore();

  return (
    <Card
      icon={<Bluetooth size={14} />}
      title="Bluetooth (Tier 1 relay)"
      badge="btleplug/WebBLE · NUS"
      badgeColor="text-sky-400 border-sky-500/30 bg-sky-500/10"
      delay={0.7}
    >
      <p class="text-xs text-zinc-500">
        Real BLE central/client — scans and talks to nearby peripherals via native backend or Web Bluetooth API.
      </p>

      <button class={scanning ? ghostBtn : primaryBtn} onClick={() => void (scanning ? stopScan() : startScan())}>
        {scanning ? "Stop scan" : "Start scan"}
      </button>

      {lastError && <p class="text-xs text-rose-400">{lastError}</p>}

      {devices.length > 0 && (
        <ul class="flex flex-col gap-1.5">
          {devices.map((d) => (
            <li key={d.id} class="flex flex-col gap-1 bg-zinc-800 rounded-lg px-3 py-1.5">
              <div class="flex items-center justify-between gap-2 text-xs font-mono">
                <span class="truncate text-zinc-300">{d.name ?? d.id}</span>
                <span class="text-zinc-500 shrink-0">{d.rssi != null ? `${d.rssi} dBm` : "—"}</span>
                <button
                  class="text-sky-400 hover:text-sky-300 shrink-0"
                  onClick={() => void (d.connected ? sendMessage(d.id, "ping from Offroute") : connect(d.id))}
                >
                  {d.connected ? "Ping" : "Connect"}
                </button>
              </div>
              {deviceErrors[d.id] && (
                <p class="text-[11px] text-rose-400">{deviceErrors[d.id]}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {messages.length > 0 && (
        <ul class="flex flex-col gap-1 max-h-24 overflow-auto">
          {messages.slice(-4).map((m, i) => (
            <li key={i} class="text-xs font-mono text-sky-300 truncate">{m.deviceId}: {m.text}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
