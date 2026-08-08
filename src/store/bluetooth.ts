import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import {
  checkPermissions,
  connect as blecConnect,
  disconnect as blecDisconnect,
  sendString,
  startScan as blecStartScan,
  stopScan as blecStopScan,
  subscribeString,
  type BleDevice as PluginDevice,
} from "@mnlphlp/plugin-blec";

/**
 * Cross-platform BLE relay (Tier 1 — see TODO.md's "Bluetooth — two tiers,
 * build tier 1 first"). Backed by the `tauri-plugin-blec` plugin: btleplug on
 * desktop + iOS (CoreBluetooth), native Kotlin/JNI on Android — so the same
 * store works on every OS. Speaks Nordic UART Service (NUS), the de facto
 * BLE serial/text-relay protocol, so this can be verified against any
 * existing NUS-compatible peripheral (e.g. a phone running nRF Connect in
 * peripheral mode). BLE central/client only — two copies of Offroute can't
 * talk directly to each other yet (needs a peripheral role, Phase 2).
 * No-ops entirely outside Tauri.
 */

// Nordic UART Service (NUS) characteristic UUIDs.
const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write to peripheral
const NUS_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notifications from peripheral

/** blec connects to one peripheral at a time — track which address that is. */
let connectedAddress: string | null = null;
/** Keeps re-issuing scans until `stopScan` flips this off (blec scans are time-boxed). */
let scanLoopActive = false;
let cachedDevices: BleDevice[] = [];

function toLocalDevice(d: PluginDevice): BleDevice {
  return {
    id: d.address,
    name: d.name || null,
    rssi: d.rssi ?? null,
    connected: d.isConnected,
  };
}

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

async function runScanLoop() {
  while (scanLoopActive) {
    try {
      await blecStartScan((pluginDevices) => {
        if (!scanLoopActive) return;
        cachedDevices = pluginDevices.map(toLocalDevice);
        useBluetoothStore.setState({ devices: cachedDevices, lastError: null });
      }, 15_000);
    } catch (err) {
      console.warn("[bluetooth] Scan cycle failed:", err);
      useBluetoothStore.setState({ lastError: String(err) });
    }
  }
}

export const useBluetoothStore = create<BluetoothState>((set, get) => ({
  scanning: false,
  devices: [],
  messages: [],
  lastError: null,
  deviceErrors: {},

  refreshDevices: async () => {
    // blec has no post-scan list command — the scan handler is the source of
    // truth, so this just re-applies the latest cached snapshot (kept for
    // callers that used to rely on the old ble_list_devices poll).
    if (!isTauri) return;
    set({ devices: cachedDevices, lastError: null });
  },

  startScan: async () => {
    if (!isTauri || get().scanning) return;
    try {
      const ok = await checkPermissions(true);
      if (!ok) throw new Error("Bluetooth/lokasi izin ditolak — aktifkan di pengaturan sistem");
      set({ scanning: true, lastError: null, devices: [], deviceErrors: {} });
      scanLoopActive = true;
      void runScanLoop();
    } catch (err) {
      console.warn("[bluetooth] Failed to start scan:", err);
      set({ lastError: String(err) });
    }
  },

  stopScan: async () => {
    if (!isTauri) return;
    scanLoopActive = false;
    try {
      await blecStopScan();
    } catch (err) {
      console.warn("[bluetooth] Failed to stop scan:", err);
    } finally {
      set({ scanning: false });
    }
  },

  connect: async (deviceId) => {
    if (!isTauri) return;
    set((s) => ({ deviceErrors: withoutKey(s.deviceErrors, deviceId) }));
    try {
      // Ensure the address is in the scanned list (Android requires a scan
      // result before connect).
      const known = cachedDevices.some((d) => d.id === deviceId);
      if (!known) throw new Error("perangkat tidak dikenal — pindai dulu");

      await blecConnect(deviceId, () => {
        connectedAddress = null;
        useBluetoothStore.setState((s) => ({
          devices: s.devices.map((d) => (d.id === deviceId ? { ...d, connected: false } : d)),
        }));
      });

      connectedAddress = deviceId;
      cachedDevices = cachedDevices.map((d) => ({
        ...d,
        connected: d.id === deviceId,
      }));
      set({ devices: cachedDevices });

      // Inbound NUS notifications → store messages (same shape as the old
      // `ble://message-received` event the Rust side used to emit).
      try {
        await subscribeString(NUS_TX_CHAR_UUID, NUS_SERVICE_UUID, (text) => {
          set((s) => ({
            messages: [
              ...s.messages,
              { deviceId, text, ts: Date.now() },
            ],
          }));
        });
      } catch (err) {
        console.warn(`[bluetooth] subscribe failed on ${deviceId}:`, err);
      }

      void get().refreshDevices();
    } catch (err) {
      console.warn(`[bluetooth] Failed to connect to ${deviceId}:`, err);
      set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: String(err) } }));
    }
  },

  disconnect: async (deviceId) => {
    if (!isTauri) return;
    try {
      await blecDisconnect();
      connectedAddress = null;
      cachedDevices = cachedDevices.map((d) => (d.id === deviceId ? { ...d, connected: false } : d));
      set({ devices: cachedDevices });
    } catch (err) {
      console.warn(`[bluetooth] Failed to disconnect ${deviceId}:`, err);
    }
  },

  sendMessage: async (deviceId, text) => {
    if (!isTauri) return;
    if (connectedAddress !== deviceId) {
      set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: "hubungkan perangkat dulu" } }));
      return;
    }
    set((s) => ({ deviceErrors: withoutKey(s.deviceErrors, deviceId) }));
    try {
      await sendString(NUS_RX_CHAR_UUID, text, "withoutResponse", NUS_SERVICE_UUID);
    } catch (err) {
      console.warn(`[bluetooth] Failed to send message to ${deviceId}:`, err);
      set((s) => ({ deviceErrors: { ...s.deviceErrors, [deviceId]: String(err) } }));
    }
  },
}));
