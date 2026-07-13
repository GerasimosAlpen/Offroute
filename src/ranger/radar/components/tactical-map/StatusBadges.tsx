import { Battery, BatteryCharging, Wifi, WifiOff } from "lucide-preact";
import { useSystemStatus } from "@/store/systemStatus";
import { isTauri } from "@/lib/tauri";

function wifiStrengthLabel(quality: number | null, connected: boolean) {
  if (!connected) return "Terputus";
  if (quality === null) return "Tidak Diketahui";
  if (quality >= 75) return "Kuat";
  if (quality >= 40) return "Sedang";
  return "Lemah";
}

export function StatusBadges() {
  const { battery, network } = useSystemStatus();

  const batteryLabel =
    isTauri && battery
      ? `Device Bat: ${battery.available ? `${battery.percent}%` : "N/A"}`
      : "Device Bat: —";
  const BatteryIcon = battery?.charging ? BatteryCharging : Battery;

  const networkLabel =
    isTauri && network
      ? `WiFi Signal: ${wifiStrengthLabel(network.qualityPercent, network.connected)}`
      : "WiFi Signal: —";
  const NetworkIcon = network?.connected === false ? WifiOff : Wifi;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <BatteryIcon size={12} className="text-[#8a8a8a]" />
        <span className="text-[#8a8a8a] text-[11px] tracking-[0.5px]">{batteryLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <NetworkIcon size={12} className="text-[#8a8a8a]" />
        <span className="text-[#8a8a8a] text-[11px] tracking-[0.5px]">{networkLabel}</span>
      </div>
    </div>
  );
}
