import { useState } from "preact/hooks";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { LocateFixed, Compass, X, Navigation, Flame, AlertTriangle, ChevronRight, Clock, Shield, Skull } from "lucide-preact";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";

import { useDeviceLocation } from "@/store/location";
import "@/lib/leaflet-setup";

// ─── Types ─────────────────────────────────────────────────────────────────

interface EventMarker {
  id: string;
  name: string;
  type: "KEBAKARAN" | "BENCANA" | "MEDIS" | "KEAMANAN";
  danger: "KRITIS" | "TINGGI" | "SEDANG";
  label: string;
  pos: [number, number];
  distance: string;
  affected: number;
}

interface RouteOption {
  id: "fastest" | "moderate" | "safest";
  label: string;
  sublabel: string;
  time: string;
  distance: string;
  danger: "tinggi" | "sedang" | "rendah";
  dangerLabel: string;
  color: string;
  borderColor: string;
  icon: typeof Skull;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DANGER_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  KRITIS: { border: "#FF0040", bg: "rgba(255,0,64,0.18)", text: "#FF0040", glow: "0 0 12px rgba(255,0,64,0.5)" },
  TINGGI: { border: "#ffb2bd", bg: "rgba(255,178,189,0.12)", text: "#ffb2bd", glow: "0 0 8px rgba(255,178,189,0.3)" },
  SEDANG: { border: "#fabd00", bg: "rgba(250,189,0,0.12)", text: "#fabd00", glow: "" },
};

const TYPE_ICONS_SVG: Record<string, string> = {
  KEBAKARAN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0040"><path d="M12 2C10 6 8 8 8 11a4 4 0 008 0c0-3-2-5-4-9z"/><path d="M10 18a2 2 0 104 0" fill="#ff6680"/></svg>`,
  BENCANA: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fabd00" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  MEDIS: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb2bd" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12h6M12 9v6"/></svg>`,
  KEAMANAN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fabd00" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
};

// ─── Map Icons ───────────────────────────────────────────────────────────────

function buildEventIcon(event: EventMarker) {
  const c = DANGER_COLORS[event.danger];
  const svg = TYPE_ICONS_SVG[event.type];
  const pulse = event.danger === "KRITIS"
    ? `<span style="position:absolute;inset:0;background:${c.border};opacity:0.2;animation:pulse 1.8s infinite;"></span>`
    : "";

  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;transform:translate(-50%,-100%);">
        <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:2px solid ${c.border};box-shadow:${c.glow};">
          ${pulse}
          ${svg}
        </div>
        <div style="background:${c.border};color:#fff;font-family:'JetBrains Mono Variable',monospace;font-size:9px;font-weight:bold;padding:2px 7px;letter-spacing:0.08em;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;">
          ${event.name}
        </div>
        <div style="background:#131313;color:${c.text};font-family:'JetBrains Mono Variable',monospace;font-size:8px;padding:1px 5px;border:1px solid ${c.border};white-space:nowrap;">
          ${event.danger} · ${event.distance}
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

// ─── Route Options ───────────────────────────────────────────────────────────

function buildRouteOptions(_event: EventMarker, distKm: number): RouteOption[] {
  const base = Math.round(distKm * 3 + 4); // rough minutes
  return [
    {
      id: "fastest",
      label: "Tercepat",
      sublabel: "Rute paling singkat, melalui zona bahaya",
      time: `${base} mnt`,
      distance: `${distKm.toFixed(1)} km`,
      danger: "tinggi",
      dangerLabel: "BAHAYA TINGGI",
      color: "#FF0040",
      borderColor: "border-[#FF0040]",
      icon: Skull,
    },
    {
      id: "moderate",
      label: "Lebih Aman",
      sublabel: "Memutar sedikit, hindari zona panas",
      time: `${base + Math.round(base * 0.4)} mnt`,
      distance: `${(distKm * 1.4).toFixed(1)} km`,
      danger: "sedang",
      dangerLabel: "BAHAYA SEDANG",
      color: "#fabd00",
      borderColor: "border-[#fabd00]",
      icon: AlertTriangle,
    },
    {
      id: "safest",
      label: "Paling Aman",
      sublabel: "Jalur memutar, zona aman sepenuhnya",
      time: `${base + Math.round(base * 0.9)} mnt`,
      distance: `${(distKm * 1.9).toFixed(1)} km`,
      danger: "rendah",
      dangerLabel: "AMAN",
      color: "#66df75",
      borderColor: "border-[#66df75]",
      icon: Shield,
    },
  ];
}

// ─── Route Sheet ─────────────────────────────────────────────────────────────

function RouteSheet({
  event,
  userPos,
  onClose,
  onSelectRoute,
}: {
  event: EventMarker;
  userPos: [number, number];
  onClose: () => void;
  onSelectRoute: (route: RouteOption) => void;
}) {
  const distKm = Math.sqrt(
    Math.pow((event.pos[0] - userPos[0]) * 111, 2) +
    Math.pow((event.pos[1] - userPos[1]) * 111, 2)
  );
  const options = buildRouteOptions(event, distKm);
  const c = DANGER_COLORS[event.danger];

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="fixed inset-x-0 bottom-0 z-[2000] bg-[#131313] border-t-2"
      style={{ borderColor: c.border }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-[#444]" />
      </div>

      {/* Header */}
      <div className="px-5 pb-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: c.text }}>
            {event.danger} · {event.type}
          </span>
          <span className="font-grotesk font-bold text-[#e5e2e1] text-base leading-tight">{event.name}</span>
          <span className="font-mono text-[10px] text-[#555]">{event.distance} dari lokasi Anda</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center border border-[#333] text-[#555] hover:text-[#e1bec2] hover:border-[#ffb2bd] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Route title */}
      <div className="px-5 pt-4 pb-2">
        <span className="font-mono text-[10px] text-[#555] uppercase tracking-widest">
          Pilih jalur navigasi
        </span>
      </div>

      {/* Route options */}
      <div className="px-4 pb-24 flex flex-col gap-2.5">
        {options.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 400, damping: 30 }}
              onClick={() => onSelectRoute(opt)}
              className={`w-full flex items-center gap-3 p-3.5 bg-[#1e1e1e] border ${opt.borderColor} hover:brightness-110 active:scale-95 transition-all text-left`}
            >
              <div
                className="w-9 h-9 flex items-center justify-center shrink-0 border"
                style={{ borderColor: opt.color, background: `${opt.color}18` }}
              >
                <Icon size={14} style={{ color: opt.color } as any} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-grotesk font-bold text-[#e5e2e1] text-sm">{opt.label}</span>
                  <span
                    className="font-mono text-[8px] px-1.5 py-0.5 border"
                    style={{ color: opt.color, borderColor: opt.color, background: `${opt.color}18` }}
                  >
                    {opt.dangerLabel}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[#666] leading-tight">{opt.sublabel}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <div className="flex items-center gap-1">
                  <Clock size={10} style={{ color: opt.color } as any} />
                  <span className="font-mono text-[11px] font-bold" style={{ color: opt.color }}>
                    {opt.time}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#555]">{opt.distance}</span>
              </div>
              <ChevronRight size={14} className="text-[#444] shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Event Popup (bottom sheet style) ─────────────────────────────────────

function EventPopup({
  event,
  onClose,
  onNavigate,
}: {
  event: EventMarker;
  userPos: [number, number];
  onClose: () => void;
  onNavigate: () => void;
}) {
  const c = DANGER_COLORS[event.danger];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="fixed bottom-[72px] left-3 right-3 z-[1500] bg-[#1a1a1a] border"
      style={{ borderColor: c.border, boxShadow: c.glow }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between border-b"
        style={{ borderColor: `${c.border}44`, background: c.bg }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[9px] font-bold px-1.5 py-0.5 border"
            style={{ color: c.text, borderColor: c.border }}
          >
            {event.danger}
          </span>
          <span className="font-grotesk font-semibold text-[#e5e2e1] text-sm leading-none">
            {event.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#555] hover:text-[#e1bec2] transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-2 font-mono text-[10px] text-[#e1bec2]">
        <div className="flex justify-between border-b border-[#2a2a2a] pb-1.5">
          <span className="text-[#555]">TIPE:</span>
          <span style={{ color: c.text }}>{event.type}</span>
        </div>
        <div className="flex justify-between border-b border-[#2a2a2a] pb-1.5">
          <span className="text-[#555]">JARAK:</span>
          <span className="text-[#e5e2e1] font-bold">{event.distance}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">TERDAMPAK:</span>
          <span className="text-[#e5e2e1]">{event.affected} orang</span>
        </div>
      </div>

      {/* Navigate button */}
      <div className="px-3 pb-3">
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-center gap-2 py-2.5 font-mono text-xs uppercase tracking-wider font-bold border transition-all hover:brightness-110 active:scale-95"
          style={{
            color: c.text,
            borderColor: c.border,
            background: c.bg,
          }}
        >
          <Navigation size={13} />
          Navigasi
        </button>
      </div>
    </motion.div>
  );
}

// ─── Clickable Marker ──────────────────────────────────────────────────────

function EventMapMarker({
  event,
  onSelect,
}: {
  event: EventMarker;
  onSelect: (e: EventMarker) => void;
}) {
  const icon = buildEventIcon(event);
  return (
    <Marker
      position={event.pos}
      icon={icon}
      eventHandlers={{ click: () => onSelect(event) }}
    />
  );
}

// ─── Map Controls ─────────────────────────────────────────────────────────

function MapControls({ userPos }: { userPos: [number, number] | null }) {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-3 z-[1000] flex flex-col gap-2">
      <button
        type="button"
        onClick={() => userPos && map.setView(userPos, 15)}
        className="size-10 flex items-center justify-center text-[#e5e2e1] hover:text-[#ffb2bd] transition-colors bg-[#1a1a1a]/95 backdrop-blur-sm border border-[#444] active:bg-[#2a2a2a]"
      >
        <LocateFixed size={16} />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function PetaTaktis() {
  const { coords, label } = useDeviceLocation();
  const [selectedEvent, setSelectedEvent] = useState<EventMarker | null>(null);
  const [showRouteSheet, setShowRouteSheet] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);

  const userPos: [number, number] = coords
    ? [coords.lat, coords.lon]
    : [-6.1818, 106.8223];

  const EVENTS: EventMarker[] = [
    {
      id: "EVT-001",
      name: "Kebakaran Gedung Kantor",
      type: "KEBAKARAN",
      danger: "KRITIS",
      label: "KODE MERAH: API",
      pos: [userPos[0] + 0.003, userPos[1] - 0.004],
      distance: "0.8 KM",
      affected: 37,
    },
    {
      id: "EVT-002",
      name: "Longsor Jalur Evakuasi",
      type: "BENCANA",
      danger: "TINGGI",
      label: "JALUR PUTUS",
      pos: [userPos[0] - 0.005, userPos[1] + 0.006],
      distance: "1.4 KM",
      affected: 12,
    },
    {
      id: "EVT-003",
      name: "Korban Luka Berat",
      type: "MEDIS",
      danger: "TINGGI",
      label: "DARURAT MEDIS",
      pos: [userPos[0] - 0.002, userPos[1] - 0.003],
      distance: "0.5 KM",
      affected: 3,
    },
    {
      id: "EVT-004",
      name: "Kerusuhan Warga",
      type: "KEAMANAN",
      danger: "SEDANG",
      label: "POSKO AMAN",
      pos: [userPos[0] + 0.001, userPos[1] + 0.002],
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
    setShowRouteSheet(true);
  };

  const handleSelectRoute = (route: RouteOption) => {
    setActiveRoute(route);
    setShowRouteSheet(false);
    // In production: trigger OSRM routing & draw polyline
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

      {/* Active route banner */}
      <AnimatePresence>
        {activeRoute && (
          <motion.div
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
                onClick={() => setActiveRoute(null)}
                className="text-[#555] hover:text-[#e1bec2]"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
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

            {/* User location */}
            <Marker position={userPos} icon={SELF_ICON} />

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
        ) : (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-[#0a0a0a]">
            <span className="font-mono text-xs text-[#666] uppercase tracking-[2px]">
              Acquiring position...
            </span>
          </div>
        )}

        {/* Coord overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-0.5 z-[1000]">
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

      {/* Event popup (above nav bar) */}
      <AnimatePresence>
        {selectedEvent && !showRouteSheet && (
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
