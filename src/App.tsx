import { useEffect } from "preact/hooks";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { lazy, Suspense } from "preact/compat";

const DemoPlayground = lazy(() => import("@/pages/DemoPlayground"));
const RadarPage = lazy(() => import("@/ranger/radar/RadarPage"));
const PersonelPage = lazy(() => import("@/ranger/personel/PersonelPage"));
const UserPage = lazy(() => import("@/user/UserPage"));
const SosPage = lazy(() => import("@/ranger/sos/SosPage"));
import { loadFlareState } from "@/store/flare";
import { useMessagePinsStore } from "@/store/messagePins";
import { useTasksStore } from "@/store/tasks";
import { useEvacuationPointsStore } from "@/store/evacuationPoints";
import { useEvacuationRequestsStore } from "@/store/evacuationRequests";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { initOfflineCache, retryQueuedMutations } from "@/lib/offlineCache";
import { socket } from "@/lib/socket";

/**
 * App-level initializer — fires once on mount to sync backend state into
 * Zustand stores before the user interacts with anything.
 */
function AppInit() {
  const online = useOnlineStatus();

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
    // Set up the local SQLite cache (no-op outside Tauri)
    void initOfflineCache();

    // The operator reseeded the database from the System Monitor — the
    // simplest correct way to get every store/query on every client back to a
    // clean, consistent state is a full reload (the `loaded` guards otherwise
    // keep the old data). This is an explicit, rare admin action.
    const onReset = () => window.location.reload();
    socket.on("data-reset", onReset);
    return () => {
      socket.off("data-reset", onReset);
    };
  }, []);

  // Fires once on mount too if already online — flushes anything queued
  // from a prior session that closed before it could replay.
  useEffect(() => {
    if (online) void retryQueuedMutations();
  }, [online]);

  return null;
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <AppInit />
      <Suspense fallback={<div class="flex items-center justify-center h-screen bg-neutral-900 text-white font-mono text-sm animate-pulse">BOOTING OFFRT_OS...</div>}>
        <Switch>
          <Route path="/ranger/radar/:tab?" component={RadarPage} />
          <Route path="/ranger/personel/:tab?" component={PersonelPage} />
          <Route path="/user/:tab?" component={UserPage} />
          <Route path="/sos" component={SosPage} />
          <Route path="/" component={DemoPlayground} />
        </Switch>
      </Suspense>
    </Router>
  );
}
