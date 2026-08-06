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
  /** Scan/list-level errors only (affects the whole card) — connect/send failures are per-device, see `deviceErrors`. */
  lastError: string | null;
  /** Keyed by device id — a failed connect/send on one device shouldn't read as "everything is broken" for every other row. */
  deviceErrors: Record<string, string>;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  sendMessage: (deviceId: string, text: string) => Promise<void>;
}

function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  const { [key]: _omit, ...rest } = record;
  return rest;
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
  deviceErrors: {},

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
    if (get().scanning) return;
    
    if (isTauri) {
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
    } else {
      // Web Bluetooth Fallback
      if (!(navigator as any).bluetooth) {
        set({ lastError: "Web Bluetooth API not supported on this browser." });
        return;
      }
      try {
        set({ scanning: true, lastError: null });
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] // NUS Service
        });
        (window as any)._webBleDevice = device;
        const newDevice: BleDevice = { id: device.id || 'web-ble', name: device.name || 'Unknown', rssi: null, connected: false };
        set((s) => {
          const exists = s.devices.find(d => d.id === newDevice.id);
          return { devices: exists ? s.devices : [...s.devices, newDevice], scanning: false };
        });
      } catch (err) {
        console.warn("[bluetooth] Web BLE error:", err);
        set({ lastError: String(err), scanning: false });
      }
    }
  },

  stopScan: async () => {
    if (scanPollTimer) {
      clearInterval(scanPollTimer);
      scanPollTimer = null;
    }
    if (isTauri) {
      try {
        await invoke("ble_stop_scan");
      } catch (err) {
        console.warn("[bluetooth] Failed to stop scan:", err);
      }
    }
    set({ scanning: false });
  },

  connect: async (deviceId) => {
    set((s) => ({ deviceErrors: withoutKey(s.deviceErrors, deviceId) }));
    if (isTauri) {
      try {
        await invoke("ble_connect", { deviceId });
        void get().refreshDevices();
      } catch (err) {
        console.warn(`[bluetooth] Failed to connect to ${deviceId}:`, err);
        set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: String(err) } }));
      }
    } else {
      // Web Bluetooth Fallback
      const device = (window as any)._webBleDevice;
      if (!device) return;
      try {
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        (window as any)._webBleCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e'); // RX
        const txCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e'); // TX
        await txCharacteristic.startNotifications();
        txCharacteristic.addEventListener('characteristicvaluechanged', (e: any) => {
           const decoder = new TextDecoder('utf-8');
           const text = decoder.decode(e.target.value);
           useBluetoothStore.setState((s) => ({
             messages: [...s.messages, { deviceId: device.id || 'web-ble', text, ts: Date.now() }],
           }));
        });
        set((s) => ({
          devices: s.devices.map(d => d.id === deviceId ? { ...d, connected: true } : d)
        }));
      } catch(err) {
        set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: String(err) } }));
      }
    }
  },

  disconnect: async (deviceId) => {
    if (isTauri) {
      try {
        await invoke("ble_disconnect", { deviceId });
        void get().refreshDevices();
      } catch (err) {
        console.warn(`[bluetooth] Failed to disconnect ${deviceId}:`, err);
      }
    } else {
      const device = (window as any)._webBleDevice;
      if (device && device.gatt.connected) {
        device.gatt.disconnect();
      }
      set((s) => ({
        devices: s.devices.map(d => d.id === deviceId ? { ...d, connected: false } : d)
      }));
    }
  },

  sendMessage: async (deviceId, text) => {
    set((s) => ({ deviceErrors: withoutKey(s.deviceErrors, deviceId) }));
    if (isTauri) {
      try {
        await invoke("ble_send_message", { deviceId, text });
      } catch (err) {
        console.warn(`[bluetooth] Failed to send message to ${deviceId}:`, err);
        set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: String(err) } }));
      }
    } else {
       const char = (window as any)._webBleCharacteristic;
       if (!char) {
         set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: "Not connected to RX characteristic" } }));
         return;
       }
       try {
         const encoder = new TextEncoder();
         await char.writeValue(encoder.encode(text));
       } catch (err) {
         set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: String(err) } }));
       }
    }
  },
}));
