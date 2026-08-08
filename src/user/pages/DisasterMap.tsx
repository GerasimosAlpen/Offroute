import { useEffect, useState, useMemo } from "preact/hooks";
import { AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import { LocateFixed, Compass, Navigation, Zap } from "lucide-preact";
import { StatusHeader } from "../components/StatusHeader";
import { TILE_URL, DEFAULT_COORDS } from "@/lib/config";
import { useDeviceLocation } from "@/store/location";
import { useIncidents } from "@/hooks/useIncidents";
import { useEvacuationPointsStore } from "@/store/evacuationPoints";
import { fetchRoadRoute, buildFallbackRoute, routeLengthMeters } from "@/lib/routing";
import { formatDistance } from "@/lib/format";
import { evacPointsToMarkers, hazardsToMarkers, type MarkerInfo, type RouteOption } from "./disaster-map/data";
import { buildUserIcon, SELF_ICON } from "./disaster-map/icons";
import { RouteDetailSheet } from "./disaster-map/RouteDetailSheet";
import "@/lib/leaflet-setup";

/** Rough on-foot pace for the ETA readout — citizens evacuate walking, not driving. */
const WALKING_KMH = 4.5;

function MapOverlay() {
  const map = useMap();
  const { coords } = useDeviceLocation();
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
      <button
        type="button"
        onClick={() => coords && map.setView([coords.lat, coords.lon], 15)}
        className="size-10 flex items-center justify-center text-[#e5e2e1] hover:text-[#ffb2bd] transition-colors bg-[#262626]/90 backdrop-blur-sm border border-[#444] active:bg-[#2a2a2a]"
      >
        <LocateFixed size={16} />
      </button>
    </div>
  );
}

export function DisasterMap() {
  const { coords } = useDeviceLocation();
  const [selectedMarker, setSelectedMarker] = useState<MarkerInfo | null>(null);
  const [activeRoute, setActiveRoute] = useState<"fastest" | "safest">(
    "fastest",
  );
  const [routeOption, setRouteOption] = useState<RouteOption | null>(null);

  const center: [number, number] = useMemo(
    () => (coords ? [coords.lat, coords.lon] : DEFAULT_COORDS),
    [coords?.lat, coords?.lon],
  );

  // Live shared data: confirmed evacuation points (where to go) + active
  // incidents (what to avoid) — the same stores/feeds every other role uses,
  // hydrated by AppInit and offline-cached underneath.
  const evacPoints = useEvacuationPointsStore((s) => s.points);
  const { data: hazards = [] } = useIncidents();
  const markers = useMemo(
    () => [...evacPointsToMarkers(evacPoints, center), ...hazardsToMarkers(hazards, center)],
    [evacPoints, hazards, center],
  );

  // A real road-snapped OSRM route from the user to the selected marker
  // (bezier fallback offline) — replaces the old hardcoded coordinate lists.
  useEffect(() => {
    if (!selectedMarker || !coords) {
      setRouteOption(null);
      return;
    }
    let stale = false;
    const from: [number, number] = [coords.lat, coords.lon];
    const to: [number, number] = [selectedMarker.lat, selectedMarker.lon];
    void (async () => {
      const route = (await fetchRoadRoute(from, to)) ?? buildFallbackRoute(from, to);
      if (stale) return;
      const distanceKm = routeLengthMeters(route) / 1000;
      setRouteOption({
        label: "Rute Jalan Kaki",
        icon: Zap,
        type: "fastest",
        distance: formatDistance(distanceKm * 1000),
        eta: `${Math.max(1, Math.round((distanceKm / WALKING_KMH) * 60))} menit`,
        coords: route,
      });
    })();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarker?.id, coords?.lat, coords?.lon]);

  const activeRouteCoords = routeOption?.coords ?? [];
  const currentRoutes = selectedMarker && routeOption ? [routeOption] : null;

  function handleNavigate(_target: MarkerInfo) {
    if (!coords) return;
    setSelectedMarker(null);
    // Plain hash only — FlareControl reads no query params, and a query
    // string on the hash would break wouter's route matching.
    window.location.hash = "#/user/flare";
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-black">
      <StatusHeader />

      <main className="flex-grow relative bg-[#262626] overflow-hidden w-full h-full">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(68,68,68,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(68,68,68,0.3) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
            pointerEvents: "none",
            mixBlendMode: "overlay",
            opacity: 0.6,
          }}
        />

        {coords
          ? (
            <MapContainer
              center={center}
              zoom={15}
              zoomControl={false}
              style={{ height: "100%", width: "100%", zIndex: 1 }}
            >
              <TileLayer
                url={TILE_URL}
                subdomains="abcd"
              />
              <Marker position={center} icon={SELF_ICON} />
              {markers.map((m) => (
                <Marker
                  key={m.id}
                  position={[m.lat, m.lon]}
                  icon={buildUserIcon(m.name, m.color)}
                  eventHandlers={{
                    click: () => {
                      setSelectedMarker(m);
                      setActiveRoute("fastest");
                    },
                  }}
                />
              ))}
              {activeRouteCoords.length > 0 && (
                <Polyline
                  positions={activeRouteCoords}
                  pathOptions={{
                    color: activeRoute === "fastest" ? "#fabd00" : "#66df75",
                    weight: 3,
                    opacity: 0.8,
                    dashArray: activeRoute === "safest" ? "8 6" : undefined,
                  }}
                />
              )}
              <MapOverlay />
            </MapContainer>
          )
          : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center bg-[#0a0a0a]">
              <span className="font-mono text-xs text-[#666] uppercase tracking-[2px]">
                Acquiring position...
              </span>
            </div>
          )}

        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-0.5">
          <div className="px-1.5 py-0.5 bg-[#262626]/90 border border-[#444] font-mono text-[10px] text-[#e1bec2] tracking-wider">
            {coords
              ? `LAT: ${coords.lat.toFixed(6)}°`
              : "LAT: —"}
          </div>
          <div className="px-1.5 py-0.5 bg-[#262626]/90 border border-[#444] font-mono text-[10px] text-[#e1bec2] tracking-wider">
            {coords
              ? `LON: ${coords.lon.toFixed(6)}°`
              : "LON: —"}
          </div>
          <div className="px-1.5 py-0.5 bg-[#262626]/90 border border-[#66df75] font-mono text-[9px] text-[#66df75]">
            GPS AKTIF
          </div>
        </div>

        <div className="absolute top-24 left-3 z-[1000]">
          <div className="w-8 h-8 border border-[#444] bg-[#262626]/90 backdrop-blur-sm flex items-center justify-center mb-1">
            <Compass size={14} className="text-[#e1bec2] -rotate-45" />
          </div>
          <div className="flex items-center">
            <div className="w-12 h-px bg-[#e1bec2] relative">
              <div className="absolute left-0 top-0 h-[3px] w-px bg-[#e1bec2] -mt-[1.5px]" />
              <div className="absolute right-0 top-0 h-[3px] w-px bg-[#e1bec2] -mt-[1.5px]" />
            </div>
            <span className="font-mono text-[8px] text-[#e1bec2] ml-1 bg-[#262626]/80 px-0.5">
              100m
            </span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-[1000]">
          <button
            type="button"
            onClick={() => {
              if (coords && selectedMarker) {
                handleNavigate(selectedMarker);
              }
            }}
            className="w-10 h-10 bg-[#cb2957] text-[#ffe9eb] border-2 border-[#ffb2bd] flex items-center justify-center hover:bg-[#b8174a] shadow-[0_0_15px_rgba(203,41,87,0.4)] active:scale-95"
          >
            <Navigation size={16} />
          </button>
        </div>
      </main>

      <AnimatePresence>
        {selectedMarker && (
          <RouteDetailSheet
            marker={selectedMarker}
            routes={currentRoutes}
            activeRoute={activeRoute}
            onSelectRoute={setActiveRoute}
            onClose={() => setSelectedMarker(null)}
            onNavigate={handleNavigate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
