import { useState, useMemo } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import {
  LocateFixed,
  Compass,
  Navigation,
  X,
  Route,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-preact";
import L from "leaflet";
import { StatusHeader } from "../components/StatusHeader";
import { useDeviceLocation } from "@/store/location";
import "@/lib/leaflet-setup";

interface MarkerInfo {
  id: string;
  name: string;
  status: string;
  distance: string;
  color: string;
  lat: number;
  lon: number;
}

interface RouteOption {
  label: string;
  icon: typeof Route;
  type: "fastest" | "safest";
  distance: string;
  eta: string;
  coords: [number, number][];
}

function buildUserIcon(name: string, color: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
        <div style="position:relative;width:14px;height:14px;">
          <span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.35;animation:pulse 2s infinite;"></span>
          <span style="position:absolute;inset:2px;border-radius:9999px;background:${color};border:2px solid #0a0a0a;"></span>
        </div>
        <div style="background:#131313;border:1px solid #444;padding:2px 6px;white-space:nowrap;">
          <span style="color:#e5e2e1;font-family:'JetBrains Mono Variable',monospace;font-size:9px;">${name}</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

const SELF_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:16px;height:16px;transform:translate(-50%,-50%);">
      <span style="position:absolute;inset:0;border-radius:9999px;background:#3ddc59;opacity:0.6;animation:pulse 2s infinite;"></span>
      <span style="position:absolute;inset:3px;border-radius:9999px;background:#3ddc59;border:2px solid #0a0a0a;"></span>
    </div>
  `,
  iconSize: [0, 0],
});

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

  const center: [number, number] = coords
    ? [coords.lat, coords.lon]
    : [-6.1818, 106.8223];

  const MOCK_MARKERS: MarkerInfo[] = [
    {
      id: "m1",
      name: "Posko Induk",
      status: "AKTIF",
      distance: "0.2 km",
      color: "#66df75",
      lat: center[0] + 0.003,
      lon: center[1] - 0.004,
    },
    {
      id: "m2",
      name: "Titik Evakuasi A",
      status: "SIAP",
      distance: "1.2 km",
      color: "#fabd00",
      lat: center[0] - 0.002,
      lon: center[1] + 0.005,
    },
    {
      id: "m3",
      name: "Laporan Kebakaran",
      status: "DITANGANI",
      distance: "0.8 km",
      color: "#FF0040",
      lat: center[0] + 0.001,
      lon: center[1] + 0.002,
    },
    {
      id: "m4",
      name: "Pos Bantuan",
      status: "AKTIF",
      distance: "0.5 km",
      color: "#66df75",
      lat: center[0] - 0.004,
      lon: center[1] - 0.003,
    },
  ];

  const routes: Record<string, RouteOption[]> = {
    m2: [
      {
        label: "Rute Tercepat",
        icon: Zap,
        type: "fastest",
        distance: "1.2 km",
        eta: "14 menit",
        coords: [
          center,
          [center[0] + 0.0002, center[1] - 0.0005],
          [center[0] - 0.001, center[1] + 0.001],
          [center[0] - 0.0015, center[1] + 0.003],
          [center[0] - 0.002, center[1] + 0.005],
        ],
      },
      {
        label: "Rute Teraman",
        icon: ShieldCheck,
        type: "safest",
        distance: "1.8 km",
        eta: "22 menit",
        coords: [
          center,
          [center[0] + 0.002, center[1] + 0.002],
          [center[0] + 0.001, center[1] + 0.005],
          [center[0] - 0.0005, center[1] + 0.006],
          [center[0] - 0.002, center[1] + 0.005],
        ],
      },
    ],
  };

  const activeRouteCoords = useMemo(() => {
    if (!selectedMarker) return [];
    const markerRoutes = routes[selectedMarker.id];
    if (!markerRoutes) return [];
    const route = markerRoutes.find((r) => r.type === activeRoute);
    return route?.coords ?? [];
  }, [selectedMarker, activeRoute]);

  const currentRoutes = selectedMarker ? routes[selectedMarker.id] : null;

  function handleNavigate(target: MarkerInfo) {
    if (!coords) return;
    setSelectedMarker(null);
    window.location.hash = `#/user/flare?lat=${target.lat}&lon=${target.lon}`;
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
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />
              <Marker position={center} icon={SELF_ICON} />
              {MOCK_MARKERS.map((m) => (
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
              ? `LAT: ${coords.lat.toFixed(6)}\u00B0`
              : "LAT: \u2014"}
          </div>
          <div className="px-1.5 py-0.5 bg-[#262626]/90 border border-[#444] font-mono text-[10px] text-[#e1bec2] tracking-wider">
            {coords
              ? `LON: ${coords.lon.toFixed(6)}\u00B0`
              : "LON: \u2014"}
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
          <motion.div
            initial={{ y: 120 }}
            animate={{ y: 0 }}
            exit={{ y: 120 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-20 left-0 right-0 z-40 mx-4 bg-[#262626] border border-[#444]"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-[#444]">
              <div className="flex items-center gap-2">
                <div
                  className={
                    "w-2.5 h-2.5 rounded-full " +
                    (
                      selectedMarker.status === "AKTIF"
                        ? "bg-[#66df75]"
                        : selectedMarker.status === "SIAP"
                        ? "bg-[#fabd00]"
                        : "bg-[#ffb2bd]"
                    )
                  }
                />
                <div>
                  <h3 className="font-grotesk font-semibold text-base text-[#e5e2e1]">
                    {selectedMarker.name}
                  </h3>
                  <span className="font-mono text-[9px] text-[#e1bec2] uppercase tracking-wider">
                    STATUS:{" "}
                    <span
                      className={
                        selectedMarker.status === "AKTIF"
                          ? "text-[#66df75]"
                          : selectedMarker.status === "SIAP"
                          ? "text-[#fabd00]"
                          : "text-[#ffb2bd]"
                      }
                    >
                      {selectedMarker.status}
                    </span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMarker(null)}
                className="cursor-pointer"
              >
                <X size={14} className="text-[#666] hover:text-[#e5e2e1]" />
              </button>
            </div>

            {/* Route selector + details */}
            <div className="p-4 flex flex-col gap-3">
              {currentRoutes
                ? (
                  <>
                    <div className="flex gap-2">
                      {currentRoutes.map((route) => {
                        const Icon = route.icon;
                        const isActive = activeRoute === route.type;
                        return (
                          <button
                            key={route.type}
                            type="button"
                            onClick={() => setActiveRoute(route.type)}
                            className={
                              "flex-1 flex items-center gap-2 px-3 py-2 border text-left transition-all cursor-pointer " +
                              (
                                isActive
                                  ? "bg-[#2a2a2a] border-[#ffb2bd]"
                                  : "bg-[#1c1b1b] border-[#444] hover:border-[#666]"
                              )
                            }
                          >
                            <Icon
                              size={16}
                              className={
                                isActive
                                  ? route.type === "fastest"
                                    ? "text-[#fabd00]"
                                    : "text-[#66df75]"
                                  : "text-[#e1bec2]"
                              }
                            />
                            <div className="flex flex-col">
                              <span
                                className={
                                  "font-mono text-[11px] " +
                                  (isActive
                                    ? "text-[#e5e2e1]"
                                    : "text-[#e1bec2]")
                                }
                              >
                                {route.label}
                              </span>
                              <span className="font-mono text-[9px] text-[#e1bec2]">
                                {route.distance} · {route.eta}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Telemetry: current route stats */}
                    {(() => {
                      const active = currentRoutes.find(
                        (r) => r.type === activeRoute,
                      );
                      if (!active) return null;
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-[#1c1b1b] border border-[#444] px-3 py-2 flex flex-col items-center">
                            <Route size={14} className="text-[#e1bec2] mb-1" />
                            <span className="font-mono text-[10px] text-[#66df75]">
                              {active.distance}
                            </span>
                            <span className="font-mono text-[8px] text-[#e1bec2] uppercase tracking-wider">
                              Jarak
                            </span>
                          </div>
                          <div className="bg-[#1c1b1b] border border-[#444] px-3 py-2 flex flex-col items-center">
                            <Timer size={14} className="text-[#e1bec2] mb-1" />
                            <span className="font-mono text-[10px] text-[#fabd00]">
                              {active.eta}
                            </span>
                            <span className="font-mono text-[8px] text-[#e1bec2] uppercase tracking-wider">
                              ETA
                            </span>
                          </div>
                          <div className="bg-[#1c1b1b] border border-[#444] px-3 py-2 flex flex-col items-center">
                            <ShieldCheck
                              size={14}
                              className={
                                activeRoute === "safest"
                                  ? "text-[#66df75] mb-1"
                                  : "text-[#fabd00] mb-1"
                              }
                            />
                            <span className="font-mono text-[10px] text-[#e1bec2]">
                              {activeRoute === "safest"
                                ? "High"
                                : "Medium"}
                            </span>
                            <span className="font-mono text-[8px] text-[#e1bec2] uppercase tracking-wider">
                              Keamanan
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => handleNavigate(selectedMarker)}
                      className="w-full py-3 bg-[#cb2957] text-[#ffe9eb] font-mono text-xs uppercase tracking-wider hover:bg-[#b8174a] transition-colors active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Navigation size={14} />
                      Navigasi ke Lokasi
                    </button>
                  </>
                )
                : (
                  <>
                    <div className="flex items-center gap-4 font-mono text-[10px] text-[#e1bec2]">
                      <span>STATUS: {selectedMarker.status}</span>
                      <span>JARAK: {selectedMarker.distance}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate(selectedMarker)}
                      className="w-full py-3 bg-[#cb2957] text-[#ffe9eb] font-mono text-xs uppercase tracking-wider hover:bg-[#b8174a] transition-colors active:scale-[0.98] cursor-pointer"
                    >
                      Navigasi ke Lokasi
                    </button>
                  </>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
