import { useEffect, useState } from "preact/hooks";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import L from "leaflet";
import { Plus, Minus, LocateFixed } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useDeviceLocation } from "@/store/location";
import { useFlareStore } from "@/store/flare";
import { useCommsLogStore } from "@/store/commsLog";
import { useBmkgQuake } from "@/store/bmkg";
import { SeismographReadout } from "./SeismographReadout";
import { BmkgTicker } from "./BmkgTicker";
import "@/lib/leaflet-setup";

type HazardKind = "fire" | "blocked" | "medical" | "crash" | "theft";

interface HazardMarker {
  id: string;
  label: string;
  /** [lat, lon] offset from the ranger's own position. */
  offset: [number, number];
  icon: L.DivIcon;
}

const HAZARD_STYLE: Record<HazardKind, { color: string; shadow: string; diamond?: boolean }> = {
  fire: { color: "#ff0040", shadow: "rgba(255,0,64,0.5)" },
  blocked: { color: "#fabd00", shadow: "rgba(250,189,0,0.3)", diamond: true },
  medical: { color: "#66df75", shadow: "rgba(102,223,117,0.3)" },
  crash: { color: "#ff7a1a", shadow: "rgba(255,122,26,0.4)", diamond: true },
  theft: { color: "#a78bfa", shadow: "rgba(167,139,250,0.4)" },
};

function buildHazardIcon(kind: HazardKind, label: string) {
  const { color, shadow, diamond } = HAZARD_STYLE[kind];
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
        <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#262626;border:2px solid ${color};box-shadow:0 0 7.5px ${shadow};border-radius:${diamond ? "4px" : "9999px"};transform:${diamond ? "rotate(45deg)" : "none"};">
          <div style="width:10px;height:10px;border-radius:9999px;background:${color};${diamond ? "transform:rotate(-45deg);" : ""}"></div>
        </div>
        <div style="background:#131313;border:1px solid ${color};padding:2px 8px;white-space:nowrap;">
          <span style="color:${color};font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

// TODO(backend): these are placeholder incidents, offset from the ranger's
// own position just so something renders nearby. Once the Lapor Incident
// report endpoint exists (README phase 2/3 — NestJS `ranger` module +
// Report/Incident model), replace this with real incident coordinates
// fetched from there instead of static offsets.
//
// These stay on the map in every phase, including idle — they're the
// day-to-day minor stuff (fire, crash, theft) the radar operator keeps an
// eye on when there's no active FLARE, not part of the drill sequence.
const MOCK_HAZARDS: HazardMarker[] = [
  { id: "a01", label: "A01 - API", offset: [0.004, -0.002], icon: buildHazardIcon("fire", "A01 - API") },
  { id: "road1", label: "JALUR PUTUS", offset: [-0.003, 0.005], icon: buildHazardIcon("blocked", "JALUR PUTUS") },
  { id: "med1", label: "EVAK MEDIS", offset: [-0.001, -0.006], icon: buildHazardIcon("medical", "EVAK MEDIS") },
  { id: "crash1", label: "KECELAKAAN", offset: [0.0025, 0.0075], icon: buildHazardIcon("crash", "KECELAKAAN") },
  { id: "theft1", label: "LAPORAN PENCURIAN", offset: [-0.006, 0.0015], icon: buildHazardIcon("theft", "LAPORAN PENCURIAN") },
];

const SELF_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:16px;height:16px;transform:translate(-50%,-50%);">
      <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#3ddc59;opacity:0.6;"></span>
      <span style="position:absolute;inset:3px;border-radius:9999px;background:#3ddc59;border:2px solid #0a0a0a;"></span>
    </div>
  `,
  iconSize: [0, 0],
});

// The earthquake epicenter the FLARE sequence flies to and marks. Offset
// from the ranger's own position since the real BMKG quake used for the
// magnitude readout could be anywhere in Indonesia — see TODO.md for why
// the drill's position stays local while borrowing the real magnitude.
const EPICENTER_OFFSET: [number, number] = [0.009, 0.011];

const EPICENTER_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:40px;height:40px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;">
      <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#ff0040;opacity:0.5;"></span>
      <span class="animate-ping" style="position:absolute;inset:8px;border-radius:9999px;background:#ff0040;opacity:0.4;animation-delay:0.3s;"></span>
      <span style="position:relative;width:14px;height:14px;border-radius:9999px;background:#ff0040;border:2px solid #fff;"></span>
    </div>
  `,
  iconSize: [0, 0],
});

const VICTIM_ICON = L.divIcon({
  className: "",
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#fabd00;opacity:0.55;"></span>
        <span style="position:relative;width:12px;height:12px;border-radius:9999px;background:#fabd00;border:2px solid #131313;"></span>
      </div>
      <div style="background:#131313;border:1px solid #fabd00;padding:2px 8px;white-space:nowrap;">
        <span style="color:#fabd00;font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;">Korban Terdeteksi</span>
      </div>
    </div>
  `,
  iconSize: [0, 0],
});

interface MeshNode {
  id: string;
  callsign: string;
  /** [lat, lon] offset from the ranger's own position. */
  offset: [number, number];
}

// TODO(backend): simulated Bluetooth-mesh peers for the offline-fallback
// demo below. Real implementation needs the Bluetooth relay research spike
// (README requirement — no official Tauri Bluetooth plugin exists yet,
// flagged as a separate scoped effort in CLAUDE.md). This is standing in for
// "we lost internet, but mesh pings from nearby personel still get through."
const MESH_NODES: MeshNode[] = [
  { id: "bravo", callsign: "TIM BRAVO", offset: [0.006, 0.004] },
  { id: "alpha", callsign: "TIM ALPHA", offset: [-0.005, -0.003] },
  { id: "charlie", callsign: "TIM CHARLIE", offset: [0.003, -0.007] },
  { id: "delta", callsign: "TIM DELTA", offset: [-0.007, 0.006] },
];

function buildMeshIcon(callsign: string) {
  return L.divIcon({
    className: "",
    html: `
      <div class="mesh-pop" style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-50%);">
        <div style="position:relative;width:22px;height:22px;">
          <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#5fb3b3;opacity:0.6;"></span>
          <span style="position:absolute;inset:5px;border-radius:9999px;background:#5fb3b3;border:2px solid #0a0a0a;"></span>
        </div>
        <div style="background:#131313;border:1px solid #5fb3b3;padding:1px 6px;white-space:nowrap;">
          <span style="color:#5fb3b3;font-family:'JetBrains Mono Variable',monospace;font-size:10px;">${callsign} · BT</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

function formatKoor(lat: number, lon: number) {
  const latHemi = lat >= 0 ? "N" : "S";
  const lonHemi = lon >= 0 ? "E" : "W";
  return `KOOR: ${Math.abs(lat).toFixed(4)}°${latHemi} ${Math.abs(lon).toFixed(4)}°${lonHemi}`;
}

/** Flat-earth approximation — fine at the sub-kilometer scale these mock offsets live at. */
function metersBetween(a: [number, number], b: [number, number]) {
  const latM = (a[0] - b[0]) * 111_320;
  const lonM = (a[1] - b[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(latM ** 2 + lonM ** 2);
}

const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

// TODO(routing): router.project-osrm.org is OSRM's public DEMO server — free,
// no key, real road-snapped routing, but rate-limited and explicitly "not
// suitable for production" per OSRM's own usage policy. Fine for a demo;
// self-host OSRM or move to a paid routing API (GraphHopper, Mapbox, etc.)
// before shipping. Also still fully online-only — the README's own
// deferred-pending-offline-decision routing phase (Dijkstra over a local
// node graph) is what would cover the offline case; this doesn't replace it.
async function fetchRoadRoute(
  start: [number, number],
  end: [number, number],
): Promise<[number, number][] | null> {
  try {
    const url = `${OSRM_ENDPOINT}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    // OSRM returns [lon, lat] pairs — Leaflet wants [lat, lon].
    return coords.map(([lon, lat]: [number, number]) => [lat, lon] as [number, number]);
  } catch {
    return null;
  }
}

/** Fallback for when OSRM is unreachable — bends a straight line into a gentle curve so it isn't a perfectly artificial line, nothing more. */
function buildFallbackRoute(start: [number, number], end: [number, number], steps = 40): [number, number][] {
  const midLat = (start[0] + end[0]) / 2;
  const midLon = (start[1] + end[1]) / 2;
  const dLat = end[0] - start[0];
  const dLon = end[1] - start[1];
  const bendLat = midLat + dLon * 0.18;
  const bendLon = midLon - dLat * 0.18;

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * bendLat + t ** 2 * end[0];
    const lon = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * bendLon + t ** 2 * end[1];
    points.push([lat, lon]);
  }
  return points;
}

/**
 * Real road routes can come back with anywhere from a handful to hundreds of
 * points — walking the animation one raw point at a time would make travel
 * time unpredictable (and occasionally absurdly long). This resamples down
 * to a fixed step count by distance along the path, so animation timing
 * stays consistent regardless of how detailed the source route is. The full
 * unsampled route is still what gets drawn on the map — this is only for
 * the moving-unit ticks.
 */
function resamplePath(points: [number, number][], steps: number): [number, number][] {
  if (points.length < 2) return points;

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + metersBetween(points[i - 1], points[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return points;

  const result: [number, number][] = [];
  for (let s = 0; s <= steps; s++) {
    const target = (s / steps) * total;
    let idx = cumulative.findIndex((d) => d >= target);
    if (idx <= 0) idx = 1;
    const segStart = cumulative[idx - 1];
    const segEnd = cumulative[idx];
    const segT = segEnd === segStart ? 0 : (target - segStart) / (segEnd - segStart);
    const [lat1, lon1] = points[idx - 1];
    const [lat2, lon2] = points[idx];
    result.push([lat1 + (lat2 - lat1) * segT, lon1 + (lon2 - lon1) * segT]);
  }
  return result;
}

const STEP_MS = 90;
const ANIMATION_STEPS = 40;
const TRAIL_LENGTH = 6;

type FlarePhase = "idle" | "detect" | "scan" | "dispatch" | "enroute" | "arrived" | "reporting" | "calm";

interface FlareProgress {
  unitsDispatched: number;
  totalUnits: number;
  etaMs: number | null;
}

/**
 * Every hazard/epicenter marker, clickable to bring "all eyes" to it — flies
 * the camera in tight on whatever the operator taps, manual rather than
 * automatic so it doesn't yank the view around on its own for the always-on
 * minor hazards.
 */
function FocusableMarkers({ ranger, phase }: { ranger: { lat: number; lon: number }; phase: FlarePhase }) {
  const map = useMap();
  const focus = (pos: [number, number]) => map.flyTo(pos, 18, { duration: 1 });

  return (
    <>
      {MOCK_HAZARDS.map((hazard) => {
        const pos: [number, number] = [ranger.lat + hazard.offset[0], ranger.lon + hazard.offset[1]];
        return (
          <Marker
            key={hazard.id}
            position={pos}
            icon={hazard.icon}
            eventHandlers={{ click: () => focus(pos) }}
          />
        );
      })}

      {phase !== "idle" &&
        (() => {
          const pos: [number, number] = [
            ranger.lat + EPICENTER_OFFSET[0],
            ranger.lon + EPICENTER_OFFSET[1],
          ];
          return (
            <Marker position={pos} icon={EPICENTER_ICON} eventHandlers={{ click: () => focus(pos) }} />
          );
        })()}
    </>
  );
}

/** Pans to follow the ranger's position — paused while a FLARE sequence is directing the camera itself. */
function FollowRanger({ lat, lon, enabled }: { lat: number; lon: number; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) map.panTo([lat, lon]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, enabled]);
  return null;
}

/**
 * Owns the whole cinematic choreography: freeze-frame beat → detect → zoom
 * out to available rangers → pick nearest → animate them along a route
 * (leaving a comet trail, spawning a second victim partway through) →
 * arrive → other teams report in → settle to a calm-but-still-searching
 * state. Everything here (mesh peers, routing, "another victim") is
 * simulated — see TODO.md. Only the magnitude number is real (BMKG).
 */
function FlareSequence({
  sequence,
  ranger,
  magnitude,
  onPhaseChange,
  onProgress,
}: {
  sequence: number;
  ranger: { lat: number; lon: number };
  magnitude: number;
  onPhaseChange: (phase: FlarePhase, banner: string | null) => void;
  onProgress: (progress: FlareProgress) => void;
}) {
  const map = useMap();
  const [revealedMesh, setRevealedMesh] = useState<MeshNode[]>([]);
  const [dispatchedId, setDispatchedId] = useState<string | null>(null);
  const [unitPos, setUnitPos] = useState<[number, number] | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [victim, setVictim] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (sequence === 0) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const log = useCommsLogStore.getState().append;

    const epicenter: [number, number] = [
      ranger.lat + EPICENTER_OFFSET[0],
      ranger.lon + EPICENTER_OFFSET[1],
    ];

    async function run() {
      setRevealedMesh([]);
      setDispatchedId(null);
      setUnitPos(null);
      setTrail([]);
      setRoute(null);
      setVictim(null);
      onProgress({ unitsDispatched: 0, totalUnits: MESH_NODES.length, etaMs: null });

      // 0. Freeze-frame beat — a held breath before everything cuts loose.
      await wait(280);
      if (cancelled) return;

      // 1. Detect — cut straight to the epicenter.
      onPhaseChange("detect", `GEMPA M${magnitude.toFixed(1)} TERDETEKSI · MEMINDAI DAMPAK SEKTOR`);
      map.flyTo(epicenter, 17, { duration: 1.4 });
      log({ sender: "SISTEM", color: "#ff0040", lead: "DETEKSI", body: `gempa M${magnitude.toFixed(1)} — memindai dampak sektor.` });
      await wait(2200);
      if (cancelled) return;

      // 2. Scan — pull back to reveal who's available via the mesh.
      onPhaseChange("scan", "MEMINDAI PERSONEL TERSEDIA VIA MESH BLUETOOTH");
      const bounds = L.latLngBounds([[ranger.lat, ranger.lon], epicenter]);
      for (const node of MESH_NODES) {
        if (cancelled) return;
        setRevealedMesh((prev) => [...prev, node]);
        bounds.extend([ranger.lat + node.offset[0], ranger.lon + node.offset[1]]);
        await wait(420);
      }
      if (cancelled) return;
      map.flyToBounds(bounds, { padding: [64, 64], duration: 1.2 });
      log({
        sender: "SISTEM",
        color: "#5fb3b3",
        lead: "MESH",
        body: `${MESH_NODES.length} personel terdeteksi via bluetooth.`,
      });
      await wait(1400);
      if (cancelled) return;

      // 3. Dispatch — nearest team to the epicenter gets sent.
      const nearest = MESH_NODES.reduce(
        (best, node) => {
          const pos: [number, number] = [ranger.lat + node.offset[0], ranger.lon + node.offset[1]];
          const d = metersBetween(pos, epicenter);
          return d < best.d ? { node, d } : best;
        },
        { node: MESH_NODES[0], d: Infinity },
      ).node;

      const start: [number, number] = [ranger.lat + nearest.offset[0], ranger.lon + nearest.offset[1]];
      onPhaseChange("dispatch", `TERDEKAT: ${nearest.callsign} · MENGHITUNG RUTE TERBAIK...`);
      log({
        sender: nearest.callsign,
        color: "#5fb3b3",
        lead: "PERINTAH DITERIMA",
        body: "menghitung rute, bersiap berangkat.",
      });
      map.flyTo(start, 16, { duration: 1.1 });

      const rawRoute = (await fetchRoadRoute(start, epicenter)) ?? buildFallbackRoute(start, epicenter);
      if (cancelled) return;
      const routePoints = resamplePath(rawRoute, ANIMATION_STEPS);
      const totalTravelMs = (routePoints.length - 1) * STEP_MS;
      setDispatchedId(nearest.id);
      setRoute(rawRoute);
      setUnitPos(start);
      setTrail([start]);
      onProgress({ unitsDispatched: 1, totalUnits: MESH_NODES.length, etaMs: totalTravelMs });

      await wait(600);
      if (cancelled) return;

      // 4. En route — animate along the route; a second victim may turn up along the way.
      onPhaseChange("enroute", `${nearest.callsign} MENUJU LOKASI...`);
      log({ sender: nearest.callsign, color: "#5fb3b3", lead: "BERANGKAT", body: "menuju lokasi kejadian." });

      const totalSteps = routePoints.length - 1;
      let victimTriggered = false;
      let approachLogged = false;

      for (let i = 1; i <= totalSteps; i++) {
        if (cancelled) return;
        setUnitPos(routePoints[i]);
        setTrail((prev) => [...prev.slice(-(TRAIL_LENGTH - 1)), routePoints[i]]);
        onProgress({
          unitsDispatched: 1,
          totalUnits: MESH_NODES.length,
          etaMs: (totalSteps - i) * STEP_MS,
        });
        const t = i / totalSteps;

        if (!victimTriggered && t > 0.5) {
          victimTriggered = true;
          const victimPos: [number, number] = [epicenter[0] - 0.0015, epicenter[1] + 0.0018];
          setVictim(victimPos);
          log({
            sender: "SISTEM",
            color: "#fabd00",
            lead: "TERDETEKSI",
            body: "korban tambahan di dekat lokasi kejadian.",
          });
        }

        if (!approachLogged && t > 0.85) {
          approachLogged = true;
          const distance = Math.round(metersBetween(routePoints[i], epicenter));
          log({
            sender: nearest.callsign,
            color: "#5fb3b3",
            lead: "MENDEKATI",
            body: `lokasi, kira-kira ${distance}m lagi.`,
          });
        }

        await wait(STEP_MS);
      }
      if (cancelled) return;

      // 5. Arrived — tight cinematic push-in on the epicenter.
      onPhaseChange("arrived", `${nearest.callsign} TIBA DI LOKASI`);
      onProgress({ unitsDispatched: 1, totalUnits: MESH_NODES.length, etaMs: 0 });
      log({ sender: nearest.callsign, color: "#5fb3b3", lead: "TIBA", body: "di lokasi. Memulai pencarian korban." });
      map.flyTo(epicenter, 18, { duration: 1, easeLinearity: 0.15 });
      setRoute(null);
      setTrail([]);
      await wait(1800);
      if (cancelled) return;

      // 6. Reporting — everyone else not dispatched checks in fine.
      onPhaseChange("reporting", "MENUNGGU LAPORAN SELURUH TIM...");
      for (const node of MESH_NODES.filter((n) => n.id !== nearest.id)) {
        if (cancelled) return;
        await wait(700);
        log({ sender: node.callsign, color: "#e5e2e1", lead: "AMAN", body: "melanjutkan patroli, tidak ada temuan." });
      }
      await wait(600);
      if (cancelled) return;

      // 7. Calm — alert stands down, but the search for the victim doesn't.
      map.flyToBounds(L.latLngBounds([[ranger.lat, ranger.lon], epicenter]), {
        padding: [80, 80],
        duration: 1.4,
      });
      onPhaseChange("calm", "SEMUA TIM MELAPOR AMAN · PENCARIAN KORBAN BERLANJUT");
      log({
        sender: "PUSAT",
        color: "#66df75",
        lead: "STATUS",
        body: "seluruh tim aman. Pencarian korban tambahan berlanjut.",
      });
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence]);

  return (
    <>
      {revealedMesh
        .filter((node) => node.id !== dispatchedId)
        .map((node) => (
          <Marker
            key={node.id}
            position={[ranger.lat + node.offset[0], ranger.lon + node.offset[1]]}
            icon={buildMeshIcon(node.callsign)}
          />
        ))}

      {route && (
        <Polyline
          positions={route}
          pathOptions={{ color: "#5fb3b3", weight: 3, dashArray: "10 8", className: "route-flow" }}
        />
      )}

      {trail.map((pos, i) => (
        <CircleMarker
          key={i}
          center={pos}
          radius={2 + (i / TRAIL_LENGTH) * 4}
          pathOptions={{
            color: "#5fb3b3",
            fillColor: "#5fb3b3",
            fillOpacity: (i / TRAIL_LENGTH) * 0.5,
            opacity: (i / TRAIL_LENGTH) * 0.5,
            weight: 1,
          }}
        />
      ))}

      {unitPos && dispatchedId && (
        <Marker
          position={unitPos}
          icon={buildMeshIcon(MESH_NODES.find((n) => n.id === dispatchedId)?.callsign ?? "")}
        />
      )}

      {victim && <Marker position={victim} icon={VICTIM_ICON} />}
    </>
  );
}

function MapControls({ coords }: { coords: { lat: number; lon: number } }) {
  const map = useMap();

  const buttons: { icon: LucideIcon; onClick: () => void }[] = [
    { icon: Plus, onClick: () => map.zoomIn() },
    { icon: Minus, onClick: () => map.zoomOut() },
    { icon: LocateFixed, onClick: () => map.setView([coords.lat, coords.lon], 15) },
  ];

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
      {buttons.map(({ icon: Icon, onClick }, i) => (
        <button
          key={i}
          type="button"
          onClick={onClick}
          className="size-10 flex items-center justify-center bg-[#262626] border border-[#444] text-[#e5e2e1] hover:border-[#FF0040]/60"
        >
          <Icon size={16} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

function OpsHud({ magnitude, progress }: { magnitude: number; progress: FlareProgress }) {
  const [displayMag, setDisplayMag] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setDisplayMag(magnitude * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [magnitude]);

  const etaLabel =
    progress.etaMs !== null
      ? `${String(Math.floor(progress.etaMs / 60_000)).padStart(2, "0")}:${String(
          Math.floor((progress.etaMs % 60_000) / 1000),
        ).padStart(2, "0")}`
      : "—:—";

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-[#131313]/95 border border-[#ff0040]/60 px-3 py-2 flex flex-col gap-1 font-mono pointer-events-none min-w-[150px]">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] text-[#8a8a8a] tracking-[1.5px] uppercase">Magnitudo</span>
        <span className="text-[#ff0040] font-bold text-sm">{displayMag.toFixed(1)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] text-[#8a8a8a] tracking-[1.5px] uppercase">Unit Dikirim</span>
        <span className="text-[#e5e2e1] text-sm">
          {progress.unitsDispatched}/{progress.totalUnits}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] text-[#8a8a8a] tracking-[1.5px] uppercase">ETA</span>
        <span className="text-[#5fb3b3] text-sm">{etaLabel}</span>
      </div>
    </div>
  );
}

/** A ring of shock expanding from screen-center across the whole map — one ping isn't enough. */
function ShockwaveRing({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0.85 }}
      animate={{ scale: 7, opacity: 0 }}
      transition={{ duration: 1.6, delay, ease: "easeOut" }}
      className="absolute top-1/2 left-1/2 z-[850] pointer-events-none rounded-full border-4 border-[#ff0040]"
      style={{ width: 100, height: 100, marginLeft: -50, marginTop: -50 }}
    />
  );
}

const BIG_BANNER_PHASES: FlarePhase[] = ["detect", "scan", "dispatch", "enroute", "arrived", "reporting"];
const DEFAULT_MAGNITUDE = 6.2;

export function TacticalMapCanvas() {
  const { coords } = useDeviceLocation();
  const { sequence: flareSequence } = useFlareStore();
  const { quake } = useBmkgQuake();
  const [phase, setPhase] = useState<FlarePhase>("idle");
  const [banner, setBanner] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [showShockwave, setShowShockwave] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [progress, setProgress] = useState<FlareProgress>({
    unitsDispatched: 0,
    totalUnits: MESH_NODES.length,
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

  const showBigBanner = BIG_BANNER_PHASES.includes(phase);
  const showCalmBadge = phase === "calm";
  const showHud = phase !== "idle";

  return (
    <div className="h-full bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-10 flex items-center justify-between px-4 bg-[#131313] border-b border-[#444]">
        <span className="text-[#e1bec2] text-sm tracking-[0.7px] uppercase">
          Grid Visual: Posisi Ranger
        </span>
        <span className="text-[#ffb2bd] text-sm tracking-[0.7px]">
          {coords ? formatKoor(coords.lat, coords.lon) : "KOOR: —"}
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
