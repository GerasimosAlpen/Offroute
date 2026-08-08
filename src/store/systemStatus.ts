import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import { BATTERY_POLL_MS, NETWORK_POLL_MS } from "@/lib/timings";

export interface BatteryStatus {
  percent: number;
  charging: boolean;
  available: boolean;
}

export interface NetworkStatus {
  connected: boolean;
  ssid: string | null;
  rssiDbm: number | null;
  qualityPercent: number | null;
}

interface SystemStatusState {
  battery: BatteryStatus | null;
  network: NetworkStatus | null;
}

/**
 * Real device battery + WiFi signal, read via Tauri Rust commands
 * (src-tauri/src/commands/system_status.rs). `null` outside Tauri (plain
 * browser dev) or if a command errors — callers should fall back to a
 * placeholder rather than treat null as zero/disconnected.
 */
export const useSystemStatusStore = create<SystemStatusState>(() => ({
  battery: null,
  network: null,
}));

let started = false;

function startPolling() {
  if (started || !isTauri) return;
  started = true;

  const pollBattery = () => {
    invoke<BatteryStatus>("get_battery_status")
      .then((battery) => useSystemStatusStore.setState({ battery }))
      .catch(() => useSystemStatusStore.setState({ battery: null }));
  };

  const pollNetwork = () => {
    invoke<NetworkStatus>("get_network_status")
      .then((network) => useSystemStatusStore.setState({ network }))
      .catch(() => useSystemStatusStore.setState({ network: null }));
  };

  pollBattery();
  pollNetwork();
  setInterval(pollBattery, BATTERY_POLL_MS);
  setInterval(pollNetwork, NETWORK_POLL_MS);
}

export function useSystemStatus(): SystemStatusState {
  startPolling();
  return useSystemStatusStore();
}
