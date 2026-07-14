import { useEffect } from "preact/hooks";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import DemoPlayground from "@/pages/DemoPlayground";
import RadarPage from "@/ranger/radar/RadarPage";
import PersonelPage from "@/ranger/personel/PersonelPage";
import { loadFlareState } from "@/store/flare";
import { useMessagePinsStore } from "@/store/messagePins";

/**
 * App-level initializer — fires once on mount to sync backend state into
 * Zustand stores before the user interacts with anything.
 */
function AppInit() {
  useEffect(() => {
    // Resume flare state from backend (e.g. page reload after a FLARE was declared)
    void loadFlareState();
    // Load persisted message pins from backend
    void useMessagePinsStore.getState().loadPins();
  }, []);

  return null;
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <AppInit />
      <Switch>
        <Route path="/ranger/radar/:tab?" component={RadarPage} />
        <Route path="/ranger/personel" component={PersonelPage} />
        <Route path="/" component={DemoPlayground} />
      </Switch>
    </Router>
  );
}
