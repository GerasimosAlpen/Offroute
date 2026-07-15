import { useState } from "preact/hooks";
import { Switch, Route } from "wouter";
import { BootSequence } from "../BootSequence";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { PetaTaktis } from "./pages/PetaTaktis";
import { DangerLevel } from "./pages/DangerLevel";
import { LogLaporan } from "./pages/LogLaporan";
import { Komunikasi } from "./pages/Komunikasi";
import { getSelfRanger } from "@/lib/rangers";
import { usePresenceHeartbeat } from "@/store/presence";
import { FlareAlertBanner } from "./components/FlareAlertBanner";

export default function PersonelPage() {
  const [self] = useState(getSelfRanger);
  // Heartbeats for the whole personel session, not just the Komunikasi page
  // — radar needs to know this unit is alive regardless of which screen
  // they're looking at.
  usePresenceHeartbeat(self);

  return (
    <BootSequence>
      {/* Personel is mobile-priority (not desktop, unlike radar) — but that
          means responsive to any screen size, not styled to look like a
          phone mockup. Full-bleed at every viewport width. */}
      <FlareAlertBanner />
      <div className="h-dvh w-screen overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <Switch>
            <Route path="/ranger/personel/bahaya" component={DangerLevel} />
            <Route path="/ranger/personel/log" component={LogLaporan} />
            <Route path="/ranger/personel/komunikasi" component={Komunikasi} />
            <Route component={PetaTaktis} />
          </Switch>
        </div>
        <MobileBottomNav />
      </div>
    </BootSequence>
  );
}
