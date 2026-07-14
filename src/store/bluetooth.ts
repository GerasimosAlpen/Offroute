import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";

/**
 * Desktop BLE relay (Tier 1 — see TODO.md's "Bluetooth — two tiers, build
 * tier 1 first"). Backed by `src-tauri/src/commands/bluetooth.rs`'s
 * `btleplug`-based commands, speaking Nordic UART Service (NUS) so this can
 * be verified against any existing NUS-compatible peripheral. This is BLE
 * central/client only — it can't yet make two Offroute instances talk
 * directly to each other, since that needs a peripheral/GATT-server role
 * too (Phase 2, not built here). No-ops entirely outside Tauri.
 */

export interface BleDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  connected: boolean;
}

export interface BleMessage {
  deviceId: string;
  text: string;
  ts: number;
}

interface BluetoothState {
  scanning: boolean;
  devices: BleDevice[];
  messages: BleMessage[];
  lastError: string | null;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  sendMessage: (deviceId: string, text: string) => Promise<void>;
}

// Polls ble_list_devices while scanning — btleplug discovers peripherals
// asynchronously in the background, there's no push event for "new device
// seen" from the Rust side, so the frontend just re-asks periodically.
const SCAN_POLL_MS = 1500;
let scanPollTimer: ReturnType<typeof setInterval> | null = null;

if (isTauri) {
  // Registered once at module scope, same discipline as the socket.io
  // subscriptions elsewhere — incoming BLE notifications from a connected
  // peripheral arrive here regardless of which component is mounted.
  listen<{ deviceId: string; text: string }>("ble://message-received", (event) => {
    const payload = event.payload;
    if (!payload || typeof payload.text !== "string") return; // malformed, ignore rather than throw
    useBluetoothStore.setState((s) => ({
      messages: [...s.messages, { deviceId: payload.deviceId, text: payload.text, ts: Date.now() }],
    }));
  }).catch((err) => console.warn("[bluetooth] Failed to listen for ble://message-received:", err));
}

export const useBluetoothStore = create<BluetoothState>((set, get) => ({
  scanning: false,
  devices: [],
  messages: [],
  lastError: null,

  refreshDevices: async () => {
    if (!isTauri) return;
    try {
      const devices = await invoke<BleDevice[]>("ble_list_devices");
      set({ devices, lastError: null });
    } catch (err) {
      console.warn("[bluetooth] Failed to list devices:", err);
      set({ lastError: String(err) });
    }
  },

  startScan: async () => {
    if (!isTauri || get().scanning) return;
    try {
      await invoke("ble_start_scan");
      set({ scanning: true, lastError: null });
      if (scanPollTimer) clearInterval(scanPollTimer);
      scanPollTimer = setInterval(() => void get().refreshDevices(), SCAN_POLL_MS);
      void get().refreshDevices();
    } catch (err) {
      console.warn("[bluetooth] Failed to start scan:", err);
      set({ lastError: String(err) });
    }
  },

  stopScan: async () => {
    if (!isTauri) return;
    if (scanPollTimer) {
      clearInterval(scanPollTimer);
      scanPollTimer = null;
    }
    try {
      await invoke("ble_stop_scan");
    } catch (err) {
      console.warn("[bluetooth] Failed to stop scan:", err);
    } finally {
      set({ scanning: false });
    }
  },

  connect: async (deviceId) => {
    if (!isTauri) return;
    try {
      await invoke("ble_connect", { deviceId });
      void get().refreshDevices();
    } catch (err) {
      console.warn(`[bluetooth] Failed to connect to ${deviceId}:`, err);
      set({ lastError: String(err) });
    }
  },

  disconnect: async (deviceId) => {
    if (!isTauri) return;
    try {
      await invoke("ble_disconnect", { deviceId });
      void get().refreshDevices();
    } catch (err) {
      console.warn(`[bluetooth] Failed to disconnect ${deviceId}:`, err);
    }
  },

  sendMessage: async (deviceId, text) => {
    if (!isTauri) return;
    try {
      await invoke("ble_send_message", { deviceId, text });
    } catch (err) {
      console.warn(`[bluetooth] Failed to send message to ${deviceId}:`, err);
      set({ lastError: String(err) });
    }
  },
}));
