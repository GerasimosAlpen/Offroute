import { Switch, Route } from "wouter";
import { BootSequence } from "../ranger/BootSequence";
import { UserBottomNav } from "./components/UserBottomNav";
import { Dashboard } from "./pages/Dashboard";
import { EmergencyReport } from "./pages/EmergencyReport";
import { DisasterMap } from "./pages/DisasterMap";
import { FlareControl } from "./pages/FlareControl";

/**
 * Citizen user mobile app entry point — wraps child pages in a boot
 * animation sequence and provides a bottom navigation bar (like
 * personel/PersonelPage but for the civilian warga role). Styled in the
 * same tactical palette with framer-motion animations throughout.
 */
export default function UserPage() {
  return (
    <BootSequence>
      <div className="h-dvh w-screen overflow-hidden flex flex-col bg-[#131313] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 overflow-y-auto pb-20">
          <Switch>
            <Route path="/user/report" component={EmergencyReport} />
            <Route path="/user/map" component={DisasterMap} />
            <Route path="/user/flare" component={FlareControl} />
            <Route component={Dashboard} />
          </Switch>
        </div>
        <UserBottomNav />
      </div>
    </BootSequence>
  );
}
