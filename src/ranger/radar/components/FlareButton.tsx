import { TriangleAlert } from "lucide-preact";
import { useState } from "preact/hooks";
import { useFlareStore } from "@/store/flare";
import { SidebarTooltip } from "./SidebarTooltip";

export function FlareButton({ collapsed }: { collapsed: boolean }) {
  const trigger = useFlareStore((s) => s.trigger);
  const [hovered, setHovered] = useState(false);

  return (
    <div className={`w-full border-t-2 border-[#444] ${collapsed ? "p-3" : "p-6"}`}>
      <button
        type="button"
        onClick={trigger}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative w-full bg-[#FF0040] hover:bg-[#ff2659] active:scale-[0.98] text-[#131313] font-mono font-bold text-sm tracking-[0.7px] uppercase flex items-center justify-center gap-2 py-3 transition-all ${
          collapsed ? "px-0" : ""
        }`}
      >
        <TriangleAlert size={18} strokeWidth={2.4} />
        {!collapsed && <span>Mode Flare</span>}
        <SidebarTooltip show={collapsed && hovered} label="Mode Flare" />
      </button>
    </div>
  );
}
