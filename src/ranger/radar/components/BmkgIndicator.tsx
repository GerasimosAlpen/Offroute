import { useState } from "preact/hooks";
import { RadioTower } from "lucide-preact";
import { useBmkgQuake } from "@/store/bmkg";
import { SidebarTooltip } from "./SidebarTooltip";

/**
 * Ambient, always-on BMKG readout for the sidebar — separate from the map's
 * own BmkgTicker, which only appears once a FLARE is active. Normal state:
 * check this. Emergency: the fuller ticker shows up in map context instead.
 */
export function BmkgIndicator({ collapsed }: { collapsed: boolean }) {
  const { status, quake } = useBmkgQuake();
  const [hovered, setHovered] = useState(false);

  const label =
    status === "ready" && quake
      ? `M${quake.magnitude.toFixed(1)} · ${quake.region}`
      : status === "loading"
        ? "Memuat BMKG..."
        : "BMKG N/A";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex items-center gap-3 w-full py-4 font-mono font-medium text-sm tracking-[0.7px] whitespace-nowrap select-none text-[#e1bec2] min-w-0 ${
        collapsed ? "justify-center px-0" : "pl-7 pr-6"
      }`}
    >
      <span className="relative flex items-center justify-center shrink-0">
        <RadioTower size={18} strokeWidth={2} />
        <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-[#66df75] animate-pulse" />
      </span>
      {!collapsed && <span className="truncate min-w-0">{label}</span>}
      <SidebarTooltip show={collapsed && hovered} label={label} />
    </div>
  );
}
