import { Switch, Route } from "wouter";
import { BootSequence } from "../BootSequence";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { PetaTaktis } from "./pages/PetaTaktis";
import { DangerLevel } from "./pages/DangerLevel";
import { LogLaporan } from "./pages/LogLaporan";
import { Komunikasi } from "./pages/Komunikasi";

export default function PersonelPage() {
  return (
    <BootSequence>
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto pb-20">
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
