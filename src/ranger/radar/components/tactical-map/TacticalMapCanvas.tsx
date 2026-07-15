import { useEffect, useState } from "preact/hooks";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-preact";
import { useDeviceLocation } from "@/store/location";
import { useFlareStore } from "@/store/flare";
import { useBmkgQuake } from "@/store/bmkg";
import { useEvacuationRequestsStore } from "@/store/evacuationRequests";
import { SeismographReadout } from "./SeismographReadout";
import { BmkgTicker } from "./BmkgTicker";
import { SELF_ICON } from "./mapIcons";
import { FocusableMarkers } from "./FocusableMarkers";
import { TaskMarkers } from "./TaskMarkers";
import { EvacuationPointMarkers } from "./EvacuationPointMarkers";
import { VictimMarkers } from "./VictimMarkers";
import { LivePersonnelMarkers } from "./LivePersonnelMarkers";
import { MessagePinMarkers } from "./MessagePinMarkers";
import { FollowRanger } from "./FollowRanger";
// MessagePinMarkers brought back for backup requests — a unit's "Minta
// Backup" now drops a pulsing red pin so HQ sees where help is needed.
import { FlareSequence, ACTIVE_DRILL_PHASES, type FlarePhase, type FlareProgress } from "./FlareSequence";
import { MapControls } from "./MapControls";
import { OpsHud } from "./OpsHud";
import { ShockwaveRing } from "./ShockwaveRing";
import { formatCoords } from "@/lib/format";
import "@/lib/leaflet-setup";

const DEFAULT_MAGNITUDE = 6.2;

export function TacticalMapCanvas() {
  const { coords } = useDeviceLocation();
  const { sequence: flareSequence } = useFlareStore();
  const { quake } = useBmkgQuake();
  const pendingEvacRequests = useEvacuationRequestsStore((s) => s.pending);
  const acceptEvacRequest = useEvacuationRequestsStore((s) => s.accept);
  const rejectEvacRequest = useEvacuationRequestsStore((s) => s.reject);
  const [phase, setPhase] = useState<FlarePhase>("idle");
  const [banner, setBanner] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [showShockwave, setShowShockwave] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [progress, setProgress] = useState<FlareProgress>({
    unitsDispatched: 0,
    totalUnits: 0,
    etaMs: null,
  });
  const shakeControls = useAnimation();

  const magnitude = quake?.magnitude ?? DEFAULT_MAGNITUDE;

  const handlePhaseChange = (nextPhase: FlarePhase, nextBanner: string | null) => {
    setPhase(nextPhase);
    setBanner(nextBanner);
  };

  // A held-breath freeze-frame right as a sequence starts, then everything cuts loose.
  useEffect(() => {
    if (flareSequence === 0) return;
    setFreeze(true);
    const t = setTimeout(() => setFreeze(false), 280);
    return () => clearTimeout(t);
  }, [flareSequence]);

  // Shake + shockwave + red flash punctuate the moment the emergency is first detected.
  useEffect(() => {
    if (phase !== "detect") return;
    void shakeControls.start({
      x: [0, -16, 16, -12, 12, -7, 7, -3, 3, 0],
      y: [0, 9, -9, 6, -6, 3, -3, 0],
      scale: [1, 1.035, 0.99, 1.015, 1],
      transition: { duration: 0.7, ease: "easeInOut" },
    });
    setShowFlash(true);
    setShowShockwave(true);
    const flashTimer = setTimeout(() => setShowFlash(false), 2400);
    const shockwaveTimer = setTimeout(() => setShowShockwave(false), 1100);
    return () => {
      clearTimeout(flashTimer);
      clearTimeout(shockwaveTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, flareSequence]);

  const showBigBanner = ACTIVE_DRILL_PHASES.includes(phase);
  const showCalmBadge = phase === "calm";
  const showHud = phase !== "idle";

  return (
    <div className="h-full bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-10 flex items-center justify-between px-4 bg-[#131313] border-b border-[#444]">
        <span className="text-[#e1bec2] text-sm tracking-[0.7px] uppercase">
          Grid Visual: Posisi Ranger
        </span>
        <span className="text-[#ffb2bd] text-sm tracking-[0.7px]">
          {coords ? `KOOR: ${formatCoords(coords.lat, coords.lon)}` : "KOOR: —"}
        </span>
      </header>

      <div className="flex-1 min-h-0 relative bg-[#0a0a0a] overflow-hidden">
        {coords ? (
          <motion.div
            animate={shakeControls}
            style={{ filter: freeze ? "grayscale(1) brightness(0.55)" : "none", transition: "filter 0.15s ease" }}
            className="absolute inset-0"
          >
            <MapContainer
              center={[coords.lat, coords.lon]}
              zoom={15}
              zoomControl={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <Marker position={[coords.lat, coords.lon]} icon={SELF_ICON} />

              <FocusableMarkers ranger={coords} phase={phase} />
              <TaskMarkers />
              <EvacuationPointMarkers />
              <VictimMarkers />
              <LivePersonnelMarkers />
              <MessagePinMarkers />

              <FollowRanger lat={coords.lat} lon={coords.lon} enabled={phase === "idle"} />
              <FlareSequence
                sequence={flareSequence}
                ranger={coords}
                magnitude={magnitude}
                onPhaseChange={handlePhaseChange}
                onProgress={setProgress}
              />
              <MapControls coords={coords} />
            </MapContainer>
          </motion.div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-xs text-[#666] uppercase tracking-[2px]">
              Acquiring position...
            </span>
          </div>
        )}

        <AnimatePresence>
          {phase !== "idle" && (
            <motion.div
              key="top-left-stack"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="absolute top-3 left-3 z-[1000] flex flex-col gap-2"
            >
              <BmkgTicker />
              <AnimatePresence>
                {(phase === "detect" || phase === "scan") && (
                  <motion.div
                    key="seismo"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <SeismographReadout magnitude={magnitude} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFlash && (
            <motion.div
              key="flash"
              initial={{ opacity: 0, backgroundColor: "#ffffff" }}
              animate={{
                opacity: [0, 0.95, 0.15, 0.4, 0.15, 0.3, 0],
                backgroundColor: ["#ffffff", "#ffffff", "#ff0040", "#ff0040", "#ff0040", "#ff0040", "#ff0040"],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.4, times: [0, 0.03, 0.15, 0.4, 0.55, 0.7, 1] }}
              className="absolute inset-0 pointer-events-none z-[900] mix-blend-screen"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showShockwave && (
            <>
              <ShockwaveRing key="ring1" />
              <ShockwaveRing key="ring2" delay={0.25} />
            </>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showBigBanner && banner && (
            <motion.div
              key={banner}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-[#131313] border border-[#ff0040] px-4 py-2 pointer-events-none max-w-[90%]"
            >
              <span className="font-mono text-xs text-[#ff0040] font-bold tracking-[2px] uppercase whitespace-nowrap">
                {banner}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCalmBadge && (
            <motion.div
              key="calm"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-[#131313] border border-[#fabd00] px-3 py-1.5 pointer-events-none flex items-center gap-2 max-w-[90%]"
            >
              <span className="size-1.5 rounded-full bg-[#fabd00] animate-pulse shrink-0" />
              <span className="font-mono text-[11px] text-[#fabd00] tracking-[1.5px] uppercase whitespace-nowrap">
                {banner}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pendingEvacRequests.length > 0 && (
            <motion.div
              key="evac-requests"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-2 max-w-[260px]"
            >
              {pendingEvacRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#131313] border border-[#66df75] px-3 py-2 flex flex-col gap-1.5"
                >
                  <span className="font-mono text-[10px] text-[#66df75] uppercase tracking-[1px]">
                    {req.ranger.name} ({req.ranger.callsign}) · Ajukan Titik Evakuasi
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void acceptEvacRequest(req.id)}
                      className="flex-1 flex items-center justify-center gap-1 border border-[#66df75] bg-[#66df75]/10 text-[#66df75] text-[10px] uppercase px-2 py-1"
                    >
                      <Check size={11} /> Terima
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectEvacRequest(req.id)}
                      className="flex-1 flex items-center justify-center gap-1 border border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] text-[10px] uppercase px-2 py-1"
                    >
                      <X size={11} /> Tolak
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showHud && (
            <motion.div
              key="hud"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <OpsHud magnitude={magnitude} progress={progress} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
