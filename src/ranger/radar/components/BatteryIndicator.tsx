import { useState } from "preact/hooks";
import { Battery, BatteryCharging, BatteryLow } from "lucide-preact";
import { useSystemStatus } from "@/store/systemStatus";
import { isTauri } from "@/lib/tauri";
import { SidebarTooltip } from "./SidebarTooltip";

/**
 * Reads the same global system-status store the Tactical Map header badges
 * use — proof the battery/network data isn't page-specific, any surface in
 * the app can pull real device vitals from one shared source.
 */
export function BatteryIndicator({ collapsed }: { collapsed: boolean }) {
  const { battery } = useSystemStatus();
  const [hovered, setHovered] = useState(false);

  if (!isTauri || !battery?.available) return null;

  const Icon =
    battery.percent <= 20 && !battery.charging
      ? BatteryLow
      : battery.charging
        ? BatteryCharging
        : Battery;
  const color = battery.percent <= 20 && !battery.charging ? "#ff8fa3" : "#e1bec2";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex items-center gap-3 w-full py-4 font-mono font-medium text-sm tracking-[0.7px] whitespace-nowrap select-none ${
        collapsed ? "justify-center px-0" : "pl-7 pr-6"
      }`}
      style={{ color }}
    >
      <Icon size={18} strokeWidth={2} className="shrink-0" />
      {!collapsed && (
        <span>
          {battery.percent}%{battery.charging ? " · Charging" : ""}
        </span>
      )}
      <SidebarTooltip
        show={collapsed && hovered}
        label={`Battery ${battery.percent}%${battery.charging ? " (charging)" : ""}`}
      />
    </div>
  );
}
