import { useEffect } from "preact/hooks";
import { RotateCcw, Map as MapIcon, TriangleAlert, Users, MessageSquare, Globe } from "lucide-preact";
import { HazardStatusPanel } from "../components/tactical-map/HazardStatusPanel";
import { CommsLogPanel } from "../components/tactical-map/CommsLogPanel";
import { PersonnelStatusPanel } from "../components/tactical-map/PersonnelStatusPanel";
import { WebBrowserPanel } from "../components/tactical-map/WebBrowserPanel";
import { TacticalMapCanvas } from "../components/tactical-map/TacticalMapCanvas";
import { StatusBadges } from "../components/tactical-map/StatusBadges";
import { StandDownButton } from "../components/tactical-map/StandDownButton";
import { FloatingWindow } from "../components/window-manager/FloatingWindow";
import { SnapOverlay } from "../components/window-manager/SnapOverlay";
import { WindowTaskbar, type TaskbarWindow } from "../components/window-manager/WindowTaskbar";
import { useWindowLayout } from "../components/window-manager/useWindowLayout";
import { useFlareStore } from "@/store/flare";

const TASKBAR_WINDOWS: TaskbarWindow[] = [
  { id: "map", title: "Peta Taktis", icon: MapIcon },
  { id: "status", title: "Status Taktis", icon: TriangleAlert },
  { id: "personnel", title: "Status Personel", icon: Users },
  { id: "comms", title: "Comm Center", icon: MessageSquare },
  { id: "browser", title: "Browser", icon: Globe },
];

// Default layout — mirrors the previous fixed 8/4 grid split as fractions.
// The whole-operation activity feed + diagnostics live on their own page
// (Monitor Sistem) so the tactical map stays uncluttered.
const DEFAULT_RECTS = {
  map: { x: 0, y: 0, w: 0.62, h: 1 },
  status: { x: 0.63, y: 0, w: 0.37, h: 0.325 },
  personnel: { x: 0.63, y: 0.335, w: 0.37, h: 0.325 },
  comms: { x: 0.63, y: 0.67, w: 0.37, h: 0.33 },
  browser: { x: 0.2, y: 0.15, w: 0.44, h: 0.6 },
};

export function TacticalMap() {
  const flareSequence = useFlareStore((s) => s.sequence);
  const resetLayout = useWindowLayout((s) => s.resetLayout);

  // Being on this page counts as "seen" — on mount, and again if a new
  // FLARE fires while the operator is already looking at the map.
  useEffect(() => {
    useFlareStore.getState().markSeen();
  }, [flareSequence]);

  // The browser is a launchable app — closed (minimized) until opened from
  // the taskbar/Start menu, so it never crowds the default desktop. Seed that
  // once, only if the operator hasn't already chosen a state for it.
  useEffect(() => {
    const wl = useWindowLayout.getState();
    if (wl.minimized["browser"] === undefined) wl.minimize("browser");
  }, []);

  return (
    <div className="flex-1 h-full overflow-hidden bg-black flex flex-col gap-3 lg:gap-6 p-4 lg:p-10 font-mono">
      <header className="shrink-0 flex items-end justify-between border-b border-[#444] pb-3 lg:pb-4 gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#66df75] animate-pulse shrink-0" />
            <span className="text-[#ffb2bd] text-xs lg:text-sm tracking-[0.7px] truncate">
              SISTEM ONLINE • ENKRIPSI AKTIF
            </span>
          </div>
          <h1 className="font-grotesk font-bold text-2xl lg:text-4xl text-[#e5e2e1] tracking-[-0.8px] uppercase">
            Pusat Komando
          </h1>
        </div>

        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          <button
            type="button"
            onClick={resetLayout}
            title="Reset tata letak jendela"
            className="flex items-center gap-1.5 border border-[#444] text-[#888] hover:text-[#e5e2e1] hover:border-[#666] text-xs uppercase px-2.5 py-1.5 transition-colors"
          >
            <RotateCcw size={12} /> Reset Layout
          </button>
          <StandDownButton />
          <StatusBadges />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <div className="flex-1 min-h-0 relative">
          <FloatingWindow id="map" title="Peta Taktis" icon={MapIcon} defaultRect={DEFAULT_RECTS.map}>
            <TacticalMapCanvas />
          </FloatingWindow>
          <FloatingWindow id="status" title="Status Taktis" icon={TriangleAlert} defaultRect={DEFAULT_RECTS.status}>
            <HazardStatusPanel />
          </FloatingWindow>
          <FloatingWindow id="personnel" title="Status Personel" icon={Users} defaultRect={DEFAULT_RECTS.personnel}>
            <PersonnelStatusPanel />
          </FloatingWindow>
          <FloatingWindow id="comms" title="Comm Center" icon={MessageSquare} defaultRect={DEFAULT_RECTS.comms}>
            <CommsLogPanel />
          </FloatingWindow>
          <FloatingWindow id="browser" title="Browser" icon={Globe} defaultRect={DEFAULT_RECTS.browser}>
            <WebBrowserPanel />
          </FloatingWindow>
          <SnapOverlay />
        </div>
        <WindowTaskbar windows={TASKBAR_WINDOWS} />
      </div>
    </div>
  );
}
