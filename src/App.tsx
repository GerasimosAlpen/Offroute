import { useEffect } from "preact/hooks";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import DemoPlayground from "@/pages/DemoPlayground";
import RadarPage from "@/ranger/radar/RadarPage";
import PersonelPage from "@/ranger/personel/PersonelPage";
import UserPage from "@/user/UserPage";
import { loadFlareState } from "@/store/flare";
import { useMessagePinsStore } from "@/store/messagePins";
import { useTasksStore } from "@/store/tasks";
import { useEvacuationPointsStore } from "@/store/evacuationPoints";
import { useEvacuationRequestsStore } from "@/store/evacuationRequests";

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
    // Resume in-progress/resolved tasks from backend
    void useTasksStore.getState().loadTasks();
    // Resume confirmed evacuation points and pending requests from backend
    void useEvacuationPointsStore.getState().loadPoints();
    void useEvacuationRequestsStore.getState().loadPending();
  }, []);

  return null;
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <AppInit />
      <Switch>
        <Route path="/ranger/radar/:tab?" component={RadarPage} />
        <Route path="/ranger/personel/:tab?" component={PersonelPage} />
        <Route path="/user/:tab?" component={UserPage} />
        <Route path="/" component={DemoPlayground} />
      </Switch>
    </Router>
  );
}
