import { Switch, Route, useLocation } from "wouter";
import { Map as MapIcon, Sparkle, Sparkles, LayoutGrid, Activity, Settings } from "lucide-preact";
import { BootSequence } from "../BootSequence";
import { ChannelSidebar } from "./components/ChannelSidebar";
import { EmergencyNotice } from "./components/EmergencyNotice";
import { TacticalMap } from "./pages/TacticalMap";
import { SquadLogs } from "./pages/SquadLogs";
import { LaporIncident } from "./pages/LaporIncident";
import { CommCenter } from "./pages/CommCenter";
import { SectorStatus } from "./pages/SectorStatus";
import { SystemMonitor } from "./pages/SystemMonitor";
import { Terminal } from "./pages/Terminal";
import { RadarSettings } from "./pages/RadarSettings";
import { useIsMobile } from "../platform";

const MOBILE_TABS = [
  { href: "/ranger/radar/map", label: "Peta", icon: MapIcon },
  { href: "/ranger/radar/incident", label: "Lapor", icon: Sparkle },
  { href: "/ranger/radar/comm", label: "Comm", icon: Sparkles },
  { href: "/ranger/radar/status", label: "Status", icon: LayoutGrid },
  { href: "/ranger/radar/monitor", label: "Monitor", icon: Activity },
  { href: "/ranger/radar/settings", label: "Setelan", icon: Settings },
];

function MobileBottomNav() {
  const [location, navigate] = useLocation();

  return (
    <nav className="shrink-0 grid grid-cols-6 border-t-2 border-[#444] bg-[#262626] select-none pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
        const active =
          location === href ||
          (href === "/ranger/radar/map" && location === "/ranger/radar");
        return (
          <button
            key={href}
            type="button"
            onClick={() => navigate(href)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] uppercase tracking-wider font-grotesk transition-colors ${
              active ? "text-[#FF0040]" : "text-[#8a8a8a] hover:text-[#e5e2e1]"
            }`}
          >
            <Icon size={18} strokeWidth={2.2} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export default function RadarPage() {
  const isMobile = useIsMobile();

  return (
    <BootSequence>
      <div
        className={`flex h-dvh w-screen overflow-hidden bg-black pt-[env(safe-area-inset-top)] ${
          isMobile ? "flex-col" : ""
        }`}
      >
        {!isMobile && <ChannelSidebar />}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
          <Switch>
            <Route path="/ranger/radar/logs" component={SquadLogs} />
            <Route path="/ranger/radar/incident" component={LaporIncident} />
            <Route path="/ranger/radar/comm" component={CommCenter} />
            <Route path="/ranger/radar/status" component={SectorStatus} />
            <Route path="/ranger/radar/monitor" component={SystemMonitor} />
            <Route path="/ranger/radar/terminal" component={Terminal} />
            <Route path="/ranger/radar/settings" component={RadarSettings} />
            <Route component={TacticalMap} />
          </Switch>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>
      <EmergencyNotice />
    </BootSequence>
  );
}
