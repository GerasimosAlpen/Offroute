import { useEffect, useState } from "preact/hooks";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import { Compass, X, Flame, Loader2, Check, Navigation } from "lucide-preact";
import { motion, AnimatePresence } from "framer-motion";

import { useDeviceLocation } from "@/store/location";
import { useDeviceHeading, startHeadingWatch } from "@/store/heading";
import "@/lib/leaflet-setup";

import { SELF_ICON, START_ICON } from "../components/peta-taktis/mapIcons";
import { EventMapMarker } from "../components/peta-taktis/EventMapMarker";
import { MapControls } from "../components/peta-taktis/MapControls";
import { IntroSequence } from "../components/peta-taktis/IntroSequence";
import { LiveFollow } from "../components/peta-taktis/LiveFollow";
import { RouteSearchSequence, type SearchParams } from "../components/peta-taktis/RouteSearchSequence";
import { RouteSheet } from "../components/peta-taktis/RouteSheet";
import { EventPopup } from "../components/peta-taktis/EventPopup";
import type { EventMarker, RouteOption } from "../components/peta-taktis/types";

export function PetaTaktis() {
  const { coords, label } = useDeviceLocation();
  const [selectedEvent, setSelectedEvent] = useState<EventMarker | null>(null);
  const [showRouteSheet, setShowRouteSheet] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  // Epic route-search sequence state — see RouteSearchSequence.
  // `runId` is bumped per pick and used as a React `key` so each pick fully
  // remounts the sequence (fresh candidates, old one's effect cleanup cancels
  // whatever was still in flight) instead of reusing stale state.
  const [searching, setSearching] = useState(false);
  const [runId, setRunId] = useState(0);
  const [searchLabel, setSearchLabel] = useState("");
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [scenarioLog, setScenarioLog] = useState<{ label: string; result: string }[]>([]);
  const { heading, available: headingAvailable } = useDeviceHeading();

  // Live position — reflects every GPS fix, moves as the crew actually moves.
  const userPos: [number, number] = coords
    ? [coords.lat, coords.lon]
    : [-6.1818, 106.8223];

  // Starting point — captured once, from the first real fix, and never
  // moves again. Hazard positions below are anchored to this (not the live
  // position), so they stay put on the map instead of drifting as the crew
  // walks around; it's also what the intro cinematic and the "start" pin use.
  const [startPos, setStartPos] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (coords && !startPos) setStartPos([coords.lat, coords.lon]);
  }, [coords, startPos]);
  const anchorPos = startPos ?? userPos;

  const EVENTS: EventMarker[] = [
    {
      id: "EVT-001",
      name: "Kebakaran Gedung Kantor",
      type: "KEBAKARAN",
      danger: "KRITIS",
      label: "KODE MERAH: API",
      pos: [anchorPos[0] + 0.003, anchorPos[1] - 0.004],
      distance: "0.8 KM",
      affected: 37,
    },
    {
      id: "EVT-002",
      name: "Longsor Jalur Evakuasi",
      type: "BENCANA",
      danger: "TINGGI",
      label: "JALUR PUTUS",
      pos: [anchorPos[0] - 0.005, anchorPos[1] + 0.006],
      distance: "1.4 KM",
      affected: 12,
    },
    {
      id: "EVT-003",
      name: "Korban Luka Berat",
      type: "MEDIS",
      danger: "TINGGI",
      label: "DARURAT MEDIS",
      pos: [anchorPos[0] - 0.002, anchorPos[1] - 0.003],
      distance: "0.5 KM",
      affected: 3,
    },
    {
      id: "EVT-004",
      name: "Kerusuhan Warga",
      type: "KEAMANAN",
      danger: "SEDANG",
      label: "POSKO AMAN",
      pos: [anchorPos[0] + 0.001, anchorPos[1] + 0.002],
      distance: "0.3 KM",
      affected: 80,
    },
  ];

  const handleSelectEvent = (event: EventMarker) => {
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
      setShowRouteSheet(false);
    } else {
      setSelectedEvent(event);
      setShowRouteSheet(false);
      setActiveRoute(null);
    }
  };

  const handleNavigate = () => {
    // iOS requires DeviceOrientationEvent.requestPermission() to be called
    // from a real tap — this is the first tap in the navigate flow, so it's
    // the right place. No-ops safely wherever the API doesn't exist at all.
    void startHeadingWatch();
    setShowRouteSheet(true);
  };

  const handleSelectRoute = (route: RouteOption) => {
    if (!selectedEvent) return;
    setActiveRoute(route);
    setShowRouteSheet(false);
    setRouteLine([]);
    setSearchLabel("MEMINDAI AREA PENCARIAN...");
    setSearchParams(null);
    setSearchProgress(0);
    setScenarioLog([]);
    setSearching(true);
    setRunId((r) => r + 1);
  };

  const handleClearRoute = () => {
    setSearching(false);
    setActiveRoute(null);
    setRouteLine([]);
    setScenarioLog([]);
  };

  const activeCount = EVENTS.filter((e) => e.danger === "KRITIS").length;

  return (
    <div className="flex-1 h-full overflow-hidden bg-black flex flex-col">
      {/* Header */}
      <header className="bg-[#131313] border-b-2 border-[#444] px-4 py-3 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-[#444] flex items-center justify-center bg-[#1e1e1e]">
            <Compass size={16} className="text-[#ffb2bd]" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] text-[#555] uppercase tracking-widest leading-none">
              Peta Taktis
            </span>
            <span className="font-grotesk font-semibold text-base text-[#e5e2e1] leading-tight">
              {coords ? (label || "—") : "Acquiring..."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 border border-[#FF0040] bg-[#FF0040]/10 animate-pulse">
              <Flame size={10} className="text-[#FF0040]" />
              <span className="font-mono text-[9px] text-[#FF0040] font-bold">{activeCount} KRITIS</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-1.5 py-0.5 border border-[#66df75] bg-[#1c1b1b]">
            <span className="font-mono text-[9px] text-[#66df75] font-bold">ONLINE</span>
          </div>
        </div>
      </header>

      {/* Route search HUD (while searching) / final nav banner (once resolved) */}
      <AnimatePresence mode="wait">
        {searching ? (
          <motion.div
            key="searching"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#0a0a0a] border-b border-[#66df75]/40"
          >
            <div className="px-4 py-2 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-[#66df75] shrink-0" />
              <span className="font-mono text-[10px] font-bold text-[#66df75] uppercase tracking-wide truncate">
                {searchLabel}
              </span>
            </div>

            {searchParams && (
              <div className="px-4 pb-2 grid grid-cols-4 gap-2 font-mono text-[9px]">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">JARAK</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.distanceKm.toFixed(2)} KM</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">WAKTU</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.timeMin} MNT</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">RISIKO</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.risk}%</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[#555]">MEDAN</span>
                  <span className="text-[#e5e2e1] font-bold truncate">{searchParams.terrain}</span>
                </div>
              </div>
            )}

            {scenarioLog.length > 0 && (
              <div className="px-4 pb-2 flex flex-col gap-1 font-mono text-[9px] max-h-24 overflow-y-auto">
                {scenarioLog.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Check size={10} className="text-[#66df75] shrink-0" />
                    <span className="text-[#666] truncate">{s.label}</span>
                    <span className="text-[#66df75] ml-auto shrink-0 truncate">{s.result}</span>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="h-[3px] bg-[#1a1a1a]">
              <motion.div
                className="h-full bg-[#66df75]"
                animate={{ width: `${searchProgress * 100}%` }}
                transition={{ ease: "linear", duration: 0.25 }}
              />
            </div>
          </motion.div>
        ) : activeRoute ? (
          <motion.div
            key="active"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-2 flex items-center justify-between border-b"
              style={{ background: `${activeRoute.color}15`, borderColor: activeRoute.color }}
            >
              <div className="flex items-center gap-2">
                <Navigation size={12} style={{ color: activeRoute.color } as any} />
                <span className="font-mono text-[10px] font-bold" style={{ color: activeRoute.color }}>
                  NAVIGASI AKTIF · {activeRoute.label.toUpperCase()}
                </span>
                <span className="font-mono text-[9px] text-[#555]">
                  {activeRoute.time} · {activeRoute.distance}
                </span>
              </div>
              <button
                onClick={handleClearRoute}
                className="text-[#555] hover:text-[#e1bec2]"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Map */}
      <main className="flex-grow relative overflow-hidden w-full h-full">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(68,68,68,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(68,68,68,0.2) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
            mixBlendMode: "overlay",
          }}
        />

        {coords ? (
          // Oversized (150%) and re-centered so that when the inner div is
          // CSS-rotated to match device heading, its corners still fully
          // cover the (smaller, overflow-hidden) viewport — a plain 100%
          // box would expose blank triangles at the corners on rotation.
          // `transform` only applies once a real heading is available;
          // otherwise this is just an inert wrapper around a north-up map.
          <div
            className="absolute"
            style={
              {
                top: "-25%",
                left: "-25%",
                width: "150%",
                height: "150%",
                "--map-heading": `${heading ?? 0}deg`,
                "--heading-available": headingAvailable ? 1 : 0,
                transform: headingAvailable && heading !== null ? "rotate(calc(-1 * var(--map-heading)))" : "none",
                transition: "transform 0.35s linear",
              } as any
            }
          >
            <MapContainer
              center={userPos}
              zoom={15}
              zoomControl={false}
              style={{ height: "100%", width: "100%", zIndex: 1 }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />

              {/* Establishing shot — always opens on the crew's real
                  starting point before anything else happens */}
              {startPos && <IntroSequence startPos={startPos} />}

              {/* Fixed pin at the point the crew started from */}
              {startPos && <Marker position={startPos} icon={START_ICON} />}

              {/* Live position — actually moves with GPS fixes */}
              <Marker position={userPos} icon={SELF_ICON} />
              <LiveFollow pos={userPos} active={!!activeRoute && !searching} />

              {/* Epic route-search cinematic — every candidate filling in,
                  sweep-compared, winner zoomed into, then swapped for the
                  real OSRM geometry (see RouteSearchSequence) */}
              {searching && selectedEvent && (
                <RouteSearchSequence
                  key={runId}
                  destination={selectedEvent}
                  userPos={startPos ?? userPos}
                  onPhase={(_phase, label, params, progress) => {
                    setSearchLabel(label);
                    setSearchParams(params);
                    setSearchProgress(progress);
                  }}
                  onScenarioTick={(entry) => setScenarioLog((prev) => [...prev, entry])}
                  onResolved={(route) => {
                    setRouteLine(route);
                    setSearching(false);
                  }}
                />
              )}

              {/* Active route, road-snapped via OSRM (src/lib/routing.ts), same
                  engine radar uses to dispatch units — with the bezier-curve
                  fallback if OSRM's unreachable */}
              {activeRoute && !searching && routeLine.length > 1 && (
                <Polyline
                  positions={routeLine}
                  pathOptions={{ color: activeRoute.color, weight: 4, opacity: 0.85 }}
                />
              )}

              {/* Event markers */}
              {EVENTS.map((event) => (
                <EventMapMarker
                  key={event.id}
                  event={event}
                  onSelect={handleSelectEvent}
                />
              ))}

              <MapControls userPos={userPos} />
            </MapContainer>
          </div>
        ) : (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-[#0a0a0a]">
            <span className="font-mono text-xs text-[#666] uppercase tracking-[2px]">
              Acquiring position...
            </span>
          </div>
        )}

        {/* Coord overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-0.5 z-[1000]">
          {coords && (
            <div className="px-1.5 py-0.5 bg-[#131313]/90 border border-[#66df75]/40 font-mono text-[9px] text-[#66df75] tracking-wider flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[#66df75] animate-pulse" />
              LIVE
            </div>
          )}
          <div className="px-1.5 py-0.5 bg-[#131313]/90 border border-[#333] font-mono text-[10px] text-[#555] tracking-wider">
            {coords ? `LAT: ${coords.lat.toFixed(5)}°` : "LAT: —"}
          </div>
          <div className="px-1.5 py-0.5 bg-[#131313]/90 border border-[#333] font-mono text-[10px] text-[#555] tracking-wider">
            {coords ? `LON: ${coords.lon.toFixed(5)}°` : "LON: —"}
          </div>
        </div>

        {/* Compass */}
        <div className="absolute top-16 left-3 z-[1000]">
          <div className="w-8 h-8 border border-[#333] bg-[#131313]/90 backdrop-blur-sm flex items-center justify-center mb-1">
            <Compass size={14} className="text-[#555] -rotate-45" />
          </div>
          <div className="flex items-center">
            <div className="w-10 h-px bg-[#444] relative">
              <div className="absolute left-0 top-0 h-[3px] w-px bg-[#444] -mt-[1.5px]" />
              <div className="absolute right-0 top-0 h-[3px] w-px bg-[#444] -mt-[1.5px]" />
            </div>
            <span className="font-mono text-[8px] text-[#555] ml-1 bg-[#131313]/80 px-0.5">100m</span>
          </div>
        </div>
      </main>

      {/* Event popup (above nav bar) — hidden once a route is being searched
          or is active, so the epic search cinematic and the resulting
          navigation view get the full map instead of this card lingering
          over a third of the screen */}
      <AnimatePresence>
        {selectedEvent && !showRouteSheet && !searching && !activeRoute && (
          <EventPopup
            event={selectedEvent}
            userPos={userPos}
            onClose={() => setSelectedEvent(null)}
            onNavigate={handleNavigate}
          />
        )}
      </AnimatePresence>

      {/* Route selection sheet */}
      <AnimatePresence>
        {showRouteSheet && selectedEvent && (
          <RouteSheet
            event={selectedEvent}
            userPos={userPos}
            onClose={() => setShowRouteSheet(false)}
            onSelectRoute={handleSelectRoute}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
