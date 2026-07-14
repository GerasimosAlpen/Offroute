import { Bluetooth, BluetoothOff } from "lucide-preact";
import { useBluetoothStore } from "@/store/bluetooth";
import { isTauri } from "@/lib/tauri";

/**
 * Surfaces the real Tier 1 BLE relay (`src/store/bluetooth.ts`,
 * `src-tauri/src/commands/bluetooth.rs`) inside Comm Center itself, instead
 * of leaving it only in the demo playground — so the operator can actually
 * tell whether Bluetooth comms are live, how many devices are currently
 * connected, and how many are around to connect to at all.
 */
export function BluetoothStatusBar() {
  const { scanning, devices, startScan, stopScan } = useBluetoothStore();

  if (!isTauri) {
    return (
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[#131313] border-b border-[#333] font-mono text-[10px] text-[#555]">
        <BluetoothOff size={11} />
        <span className="uppercase tracking-wide">Bluetooth tidak tersedia (bukan desktop app)</span>
      </div>
    );
  }

  const connectedCount = devices.filter((d) => d.connected).length;
  const totalCount = devices.length;

  return (
    <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-[#131313] border-b border-[#333] font-mono text-[10px]">
      <div className="flex items-center gap-2">
        <Bluetooth size={11} className={scanning ? "text-[#5fb3b3]" : "text-[#555]"} />
        <span className={`uppercase tracking-wide font-bold ${scanning ? "text-[#5fb3b3]" : "text-[#555]"}`}>
          {scanning ? "Bluetooth Aktif" : "Bluetooth Nonaktif"}
        </span>
        <span className="text-[#666]">
          {connectedCount} terhubung · {totalCount} terjangkau
        </span>
      </div>
      <button
        type="button"
        onClick={() => void (scanning ? stopScan() : startScan())}
        className={`px-2 py-0.5 border uppercase tracking-wide ${
          scanning
            ? "border-[#444] text-[#666] hover:text-[#e1bec2] hover:border-[#666]"
            : "border-[#5fb3b3] text-[#5fb3b3] hover:bg-[#5fb3b3]/10"
        }`}
      >
        {scanning ? "Matikan" : "Pindai"}
      </button>
    </div>
  );
}
