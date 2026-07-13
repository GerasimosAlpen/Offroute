// Don't code here, go somewhere else

import { Switch, Route } from "wouter";
import { DesktopOnlyGate } from "../DesktopOnlyGate";
import { BootSequence } from "../BootSequence";
import { ChannelSidebar } from "./components/ChannelSidebar";
import { TacticalMap } from "./pages/TacticalMap";
import { SquadLogs } from "./pages/SquadLogs";
import { LaporIncident } from "./pages/LaporIncident";
import { CommCenter } from "./pages/CommCenter";
import { SectorStatus } from "./pages/SectorStatus";
import { RadarSettings } from "./pages/RadarSettings";

export default function RadarPage() {
  return (
    <DesktopOnlyGate>
      <BootSequence>
        <div className="flex h-screen w-screen overflow-x-hidden">
          <ChannelSidebar />
          <Switch>
            <Route path="/ranger/radar/logs" component={SquadLogs} />
            <Route path="/ranger/radar/incident" component={LaporIncident} />
            <Route path="/ranger/radar/comm" component={CommCenter} />
            <Route path="/ranger/radar/status" component={SectorStatus} />
            <Route path="/ranger/radar/settings" component={RadarSettings} />
            <Route component={TacticalMap} />
          </Switch>
        </div>
      </BootSequence>
    </DesktopOnlyGate>
  );
}
