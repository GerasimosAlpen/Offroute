import { useEffect, useState } from "preact/hooks";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import L from "leaflet";
import { Plus, Minus, LocateFixed, Check, X } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useDeviceLocation } from "@/store/location";
import { useFlareStore } from "@/store/flare";
import { useCommsLogStore } from "@/store/commsLog";
import { useBmkgQuake } from "@/store/bmkg";
import { useTasksStore, getRangerPosition } from "@/store/tasks";
import { useMessagePinsStore } from "@/store/messagePins";
import { RANGERS, type Ranger } from "@/lib/rangers";
import { HAZARDS, type HazardKind } from "@/lib/hazards";
import {
  fetchRoadRoute,
  buildFallbackRoute,
  metersBetween,
  animateAlongRoute,
  animateRouteReveal,
  simulatedTravelDurationMs,
  routeBlockedBy,
} from "@/lib/routing";
import { useEvacuationPointsStore } from "@/store/evacuationPoints";
import { useEvacuationRequestsStore } from "@/store/evacuationRequests";
import { SeismographReadout } from "./SeismographReadout";
import { BmkgTicker } from "./BmkgTicker";
import "@/lib/leaflet-setup";

const HAZARD_STYLE: Record<HazardKind, { color: string; shadow: string; diamond?: boolean }> = {
  fire: { color: "#ff0040", shadow: "rgba(255,0,64,0.5)" },
  blocked: { color: "#fabd00", shadow: "rgba(250,189,0,0.3)", diamond: true },
  medical: { color: "#66df75", shadow: "rgba(102,223,117,0.3)" },
  crash: { color: "#ff7a1a", shadow: "rgba(255,122,26,0.4)", diamond: true },
  theft: { color: "#a78bfa", shadow: "rgba(167,139,250,0.4)" },
};

function buildHazardIcon(kind: HazardKind, label: string, minimized = false) {
  const { color, shadow, diamond } = HAZARD_STYLE[kind];
  const size = minimized ? 16 : 32;
  const dot = minimized ? 6 : 10;
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);opacity:${minimized ? 0.45 : 1};">
        <div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:#262626;border:2px solid ${color};box-shadow:0 0 7.5px ${shadow};border-radius:${diamond ? "4px" : "9999px"};transform:${diamond ? "rotate(45deg)" : "none"};">
          <div style="width:${dot}px;height:${dot}px;border-radius:9999px;background:${color};${diamond ? "transform:rotate(-45deg);" : ""}"></div>
        </div>
        ${
          minimized
            ? ""
            : `<div style="background:#131313;border:1px solid ${color};padding:2px 8px;white-space:nowrap;">
          <span style="color:${color};font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;">${label}</span>
        </div>`
        }
      </div>
    `,
    iconSize: [0, 0],
  });
}

// Icons built once per hazard from the shared `HAZARDS` data (src/lib/hazards.ts) — same source the Status Taktis sidebar panel reads, so map markers and the sidebar list always agree.
const HAZARD_ICONS: Record<string, { icon: L.DivIcon; iconMinimized: L.DivIcon }> = Object.fromEntries(
  HAZARDS.map((h) => [
    h.id,
    { icon: buildHazardIcon(h.kind, h.label), iconMinimized: buildHazardIcon(h.kind, h.label, true) },
  ]),
);

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

function buildRangerIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `
      <div class="mesh-pop" style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-50%);">
        <div style="position:relative;width:22px;height:22px;">
          <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#5fb3b3;opacity:0.6;"></span>
          <span style="position:absolute;inset:5px;border-radius:9999px;background:#5fb3b3;border:2px solid #0a0a0a;"></span>
        </div>
        <div style="background:#131313;border:1px solid #5fb3b3;padding:1px 6px;white-space:nowrap;">
          <span style="color:#5fb3b3;font-family:'JetBrains Mono Variable',monospace;font-size:10px;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

const MESSAGE_PIN_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:20px;height:20px;transform:translate(-50%,-100%);display:flex;align-items:center;justify-content:center;">
      <div style="width:20px;height:20px;border-radius:9999px 9999px 9999px 2px;background:#e5e2e1;border:2px solid #131313;transform:rotate(45deg);"></div>
    </div>
  `,
  iconSize: [0, 0],
});

const EVAC_POINT_ICON = L.divIcon({
  className: "",
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#131313;border:2px solid #66df75;border-radius:9999px;box-shadow:0 0 8px rgba(102,223,117,0.5);">
        <div style="width:12px;height:12px;border-radius:9999px;background:#66df75;"></div>
      </div>
      <div style="background:#131313;border:1px solid #66df75;padding:2px 8px;white-space:nowrap;">
        <span style="color:#66df75;font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;">Titik Evakuasi Aman</span>
      </div>
    </div>
  `,
  iconSize: [0, 0],
});

function formatKoor(lat: number, lon: number) {
  const latHemi = lat >= 0 ? "N" : "S";
  const lonHemi = lon >= 0 ? "E" : "W";
  return `KOOR: ${Math.abs(lat).toFixed(4)}°${latHemi} ${Math.abs(lon).toFixed(4)}°${lonHemi}`;
}

type FlarePhase = "idle" | "detect" | "scan" | "dispatch" | "enroute" | "arrived" | "reporting" | "calm";

interface FlareProgress {
  unitsDispatched: number;
  totalUnits: number;
  etaMs: number | null;
}

const ACTIVE_DRILL_PHASES: FlarePhase[] = ["detect", "scan", "dispatch", "enroute", "arrived", "reporting"];

/**
 * Every hazard/epicenter marker, clickable to bring "all eyes" to it — flies
 * the camera in tight on whatever the operator taps, manual rather than
 * automatic so it doesn't yank the view around on its own for the always-on
 * minor hazards.
 */
function FocusableMarkers({ ranger, phase }: { ranger: { lat: number; lon: number }; phase: FlarePhase }) {
  const map = useMap();
  const focus = (pos: [number, number]) => map.flyTo(pos, 18, { duration: 1 });
  const minimizeMinorHazards = ACTIVE_DRILL_PHASES.includes(phase);

  return (
    <>
      {HAZARDS.map((hazard) => {
        const pos: [number, number] = [ranger.lat + hazard.offset[0], ranger.lon + hazard.offset[1]];
        const icons = HAZARD_ICONS[hazard.id];
        return (
          <Marker
            key={hazard.id}
            position={pos}
            icon={minimizeMinorHazards ? icons.iconMinimized : icons.icon}
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

/**
 * Ad-hoc ranger tasks (`src/store/tasks.ts`) — the general "Budi takes the
 * crash" case, independent of the FLARE drill. One marker + route per active
 * task, smoothly gliding (see `animateAlongRoute`), left on the map once
 * arrived.
 */
function TaskMarkers() {
  const tasks = useTasksStore((s) => s.tasks);
  const map = useMap();
  const focus = (pos: [number, number]) => map.flyTo(pos, 18, { duration: 1 });

  return (
    <>
      {Object.values(tasks).flatMap((task) => {
        const rangerProfile = RANGERS.find((r) => r.id === task.rangerId);
        const label = rangerProfile
          ? task.status === "arrived"
            ? `${rangerProfile.name} · TIBA`
            : rangerProfile.name
          : "";
        const layers = [];
        // Minor ad-hoc hazards (fire/crash/theft/etc.) are the routine, not
        // the drama — kept thin and dim, not the bright flowing style
        // reserved for major FLARE emergencies, and cleared entirely on
        // arrival (see src/store/tasks.ts) rather than lingering.
        if (task.route.length > 1) {
          layers.push(
            <Polyline
              key={`${task.hazardId}-route`}
              positions={task.route}
              pathOptions={{ color: "#66df75", weight: 1.5, opacity: 0.4, dashArray: "4 6" }}
            />,
          );
        }
        layers.push(
          <Marker
            key={`${task.hazardId}-marker`}
            position={task.unitPos}
            icon={buildRangerIcon(label)}
            eventHandlers={{ click: () => focus(task.unitPos) }}
          />,
        );
        return layers;
      })}
    </>
  );
}

/** Personel status messages, pinned to wherever they were sent from (`src/store/messagePins.ts`). */
function MessagePinMarkers() {
  const pins = useMessagePinsStore((s) => s.pins);
  return (
    <>
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lon]} icon={MESSAGE_PIN_ICON}>
          <Popup>
            <div className="font-mono text-xs flex flex-col gap-1">
              <span className="font-bold text-[#131313]">
                {pin.rangerName} · {pin.callsign}
              </span>
              <span>{pin.text}</span>
              <span className="text-[10px] text-zinc-500">
                {new Date(pin.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

/**
 * Safe-zone points a ranger has pinged ("everyone here is okay"), plus the
 * route from the incident to each one (`src/store/evacuationPoints.ts`).
 */
function EvacuationPointMarkers() {
  const points = useEvacuationPointsStore((s) => s.points);
  return (
    <>
      {points.flatMap((point) => {
        const layers = [];
        if (point.route.length > 1) {
          layers.push(
            <Polyline
              key={`${point.id}-route`}
              positions={point.route}
              pathOptions={{ color: "#66df75", weight: 3, dashArray: "6 6", className: "route-flow" }}
            />,
          );
        }
        layers.push(
          <Marker key={`${point.id}-marker`} position={[point.lat, point.lon]} icon={EVAC_POINT_ICON}>
            <Popup>
              <div className="font-mono text-xs flex flex-col gap-1">
                <span className="font-bold text-[#131313]">
                  {point.rangerName} · {point.callsign}
                </span>
                <span>Titik evakuasi aman — seluruh korban dalam kondisi baik.</span>
                <span className="text-[10px] text-zinc-500">
                  {new Date(point.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </Popup>
          </Marker>,
        );
        return layers;
      })}
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

const TRAIL_LENGTH = 6;

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
  const [revealedMesh, setRevealedMesh] = useState<Ranger[]>([]);
  const [dispatchedId, setDispatchedId] = useState<string | null>(null);
  const [unitPos, setUnitPos] = useState<[number, number] | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [evacRoutes, setEvacRoutes] = useState<
    { rangerId: string; route: [number, number][]; blocked: boolean }[]
  >([]);
  const [victim, setVictim] = useState<[number, number] | null>(null);
  // Every other available (not already busy on an ad-hoc task) ranger,
  // dispatched to help search once the primary unit is enroute — keyed by
  // ranger id so each can glide independently.
  const [backupUnits, setBackupUnits] = useState<
    Record<string, { pos: [number, number]; route: [number, number][] }>
  >({});
  // Which backup unit (if any) has its route line shown + camera focus.
  // Only one at a time on purpose — with several units moving at once,
  // showing every route simultaneously turns into an unreadable tangle of
  // waypoints, so routes stay hidden until the operator picks one.
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Wherever a ranger actually is right now — shared with the ad-hoc task
  // system (src/store/tasks.ts), so a ranger who's already moved via a
  // "Kirim Unit" assignment doesn't reset to their static home spot the
  // moment a FLARE fires (and vice versa). Kept at component scope (not just
  // inside the effect) so the mesh-marker JSX below can use it too.
  const posOf = (r: Ranger): [number, number] =>
    getRangerPosition(r.id, [ranger.lat + r.offset[0], ranger.lon + r.offset[1]]);

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
      setEvacRoutes([]);
      setVictim(null);
      setBackupUnits({});
      setFocusedId(null);
      onProgress({ unitsDispatched: 0, totalUnits: RANGERS.length, etaMs: null });

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
      for (const node of RANGERS) {
        if (cancelled) return;
        setRevealedMesh((prev) => [...prev, node]);
        bounds.extend(posOf(node));
        await wait(420);
      }
      if (cancelled) return;
      map.flyToBounds(bounds, { padding: [64, 64], duration: 1.2 });
      log({
        sender: "SISTEM",
        color: "#5fb3b3",
        lead: "MESH",
        body: `${RANGERS.length} personel terdeteksi via bluetooth.`,
      });
      await wait(1400);
      if (cancelled) return;

      // 3. Dispatch — every team's possible evacuation route gets computed
      // and shown first, checked against known blocked roads, and *then*
      // the best *available* (not just nearest) team gets sent.
      onPhaseChange("dispatch", "MENGHITUNG SEMUA RUTE EVAKUASI YANG MUNGKIN...");
      log({
        sender: "PUSAT",
        color: "#66df75",
        lead: "RUTE",
        body: "menghitung seluruh kemungkinan rute evakuasi untuk semua tim.",
      });

      const blockedRoadPositions: [number, number][] = HAZARDS.filter((h) => h.kind === "blocked").map(
        (h) => [ranger.lat + h.offset[0], ranger.lon + h.offset[1]] as [number, number],
      );

      const allRoutes = await Promise.all(
        RANGERS.map(async (node) => {
          const from: [number, number] = posOf(node);
          const r = (await fetchRoadRoute(from, epicenter)) ?? buildFallbackRoute(from, epicenter);
          return { rangerId: node.id, route: r, blocked: routeBlockedBy(r, blockedRoadPositions) };
        }),
      );
      if (cancelled) return;

      // Prefer an available (unblocked) route over a merely-shorter blocked one.
      const nearest = RANGERS
        .map((node) => {
          const pos: [number, number] = posOf(node);
          const routeInfo = allRoutes.find((r) => r.rangerId === node.id);
          return { node, d: metersBetween(pos, epicenter), blocked: routeInfo?.blocked ?? false };
        })
        .sort((a, b) => Number(a.blocked) - Number(b.blocked) || a.d - b.d)[0].node;
      const senderName = `${nearest.name} (${nearest.callsign})`;

      // Cascade them in one at a time rather than popping in all at once.
      setEvacRoutes(allRoutes.map((r) => ({ ...r, route: [] })));
      await Promise.all(
        allRoutes.map(async (r, i) => {
          await wait(i * 130);
          if (cancelled) return;
          await animateRouteReveal(
            r.route,
            650,
            (partial) => {
              setEvacRoutes((prev) =>
                prev.map((p) => (p.rangerId === r.rangerId ? { ...p, route: partial } : p)),
              );
            },
            () => cancelled,
          );
        }),
      );
      if (cancelled) return;
      const blockedCount = allRoutes.filter((r) => r.blocked).length;
      log({
        sender: "PUSAT",
        color: "#66df75",
        lead: "RUTE DIKIRIM",
        body:
          blockedCount > 0
            ? `${allRoutes.length} rute dihitung (${blockedCount} terblokir jalan rusak), dikirim ke seluruh tim.`
            : `${allRoutes.length} rute evakuasi dihitung, semua tersedia, dikirim ke seluruh tim.`,
      });
      await wait(500);
      if (cancelled) return;

      const start: [number, number] = posOf(nearest);
      onPhaseChange("dispatch", `TERDEKAT: ${senderName} · MENGIRIM RUTE TERBAIK...`);
      log({
        sender: senderName,
        color: "#5fb3b3",
        lead: "PERINTAH DITERIMA",
        body: "rute terbaik diterima, bersiap berangkat.",
      });
      map.flyTo(start, 16, { duration: 1.1 });

      const rawRoute = allRoutes.find((r) => r.rangerId === nearest.id)?.route ?? buildFallbackRoute(start, epicenter);
      const travelDurationMs = simulatedTravelDurationMs(rawRoute, 3600, 3600);
      setDispatchedId(nearest.id);
      setUnitPos(start);
      setTrail([start]);
      onProgress({ unitsDispatched: 1, totalUnits: RANGERS.length, etaMs: travelDurationMs });

      // Trace the chosen route from start to end instead of it just appearing.
      await animateRouteReveal(
        rawRoute,
        900,
        (partial) => {
          setRoute(partial);
          const tip = partial[partial.length - 1];
          setUnitPos(tip);
          useTasksStore.getState().setRangerPosition(nearest.id, tip);
        },
        () => cancelled,
      );
      if (cancelled) return;
      log({
        sender: "PUSAT",
        color: "#66df75",
        lead: "RUTE DIKIRIM",
        body: `rute terbaik (${(metersBetween(start, epicenter) / 1000).toFixed(1)}km) dikirim ke ${senderName}.`,
      });

      await wait(300);
      if (cancelled) return;

      // 4. En route — glide smoothly along the route; a second victim may turn up along the way.
      onPhaseChange("enroute", `${senderName} MENUJU LOKASI...`);
      log({ sender: senderName, color: "#5fb3b3", lead: "BERANGKAT", body: "menuju lokasi kejadian." });

      let victimTriggered = false;
      let approachLogged = false;
      let victimLocation: [number, number] | null = null;

      await animateAlongRoute(
        rawRoute,
        travelDurationMs,
        (pos, t) => {
          setUnitPos(pos);
          setTrail((prev) => [...prev.slice(-(TRAIL_LENGTH - 1)), pos]);
          useTasksStore.getState().setRangerPosition(nearest.id, pos);
          onProgress({
            unitsDispatched: 1,
            totalUnits: RANGERS.length,
            etaMs: Math.max(0, travelDurationMs * (1 - t)),
          });

          if (!victimTriggered && t > 0.5) {
            victimTriggered = true;
            const victimPos: [number, number] = [epicenter[0] - 0.0015, epicenter[1] + 0.0018];
            victimLocation = victimPos;
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
            const distance = Math.round(metersBetween(pos, epicenter));
            log({
              sender: senderName,
              color: "#5fb3b3",
              lead: "MENDEKATI",
              body: `lokasi, kira-kira ${distance}m lagi.`,
            });
          }
        },
        () => cancelled,
      );
      if (cancelled) return;

      // 5. Arrived — tight cinematic push-in on the epicenter. Route's done
      // its job leading the unit in, so it's cleared here (not left bright
      // and drawn) and the ranger's position is pinned to where they actually
      // are now — same pattern as the ad-hoc task system's arrival handling.
      onPhaseChange("arrived", `${senderName} TIBA DI LOKASI`);
      onProgress({ unitsDispatched: 1, totalUnits: RANGERS.length, etaMs: 0 });
      log({ sender: senderName, color: "#5fb3b3", lead: "TIBA", body: "di lokasi. Memulai pencarian korban." });
      map.flyTo(epicenter, 18, { duration: 1, easeLinearity: 0.15 });
      setTrail([]);
      setRoute(null);
      setUnitPos(epicenter);
      useTasksStore.getState().setRangerPosition(nearest.id, epicenter);
      await wait(1400);
      if (cancelled) return;

      // 5b. Radar can't see the victim directly — the only realtime signal
      // is whatever the dispatched personel's own phone can pick up (see
      // TODO.md for the offline-beacon approach this is standing in for).
      // So radar asks, personel answers with whatever their hardware found.
      log({
        sender: "PUSAT",
        color: "#66df75",
        lead: "TANYA",
        body: `${senderName}, apakah perangkat Anda mendeteksi sinyal korban?`,
      });
      await wait(1000);
      if (cancelled) return;
      const victimDistance = victimLocation ? Math.round(metersBetween(epicenter, victimLocation)) : null;
      log(
        victimDistance !== null
          ? {
              sender: senderName,
              color: "#fabd00",
              lead: "TERDETEKSI",
              body: `sinyal ponsel korban terbaca, perkiraan jarak ${victimDistance}m.`,
            }
          : {
              sender: senderName,
              color: "#e5e2e1",
              lead: "NIHIL",
              body: "belum ada sinyal korban dalam jangkauan, mencari terus.",
            },
      );
      await wait(1400);
      if (cancelled) return;

      // 5c. Ranger *offers* their own position as a safe evacuation point —
      // their call ("if they want to"), not automatic. Only meaningful for
      // a major emergency like this one, never a minor ad-hoc hazard. No
      // personel app exists yet, so this stands in for that tap; PUSAT
      // (radar) still has to accept or reject it before anything's pinned.
      useEvacuationRequestsStore.getState().request(nearest, epicenter, epicenter);

      // 6. Reporting — everyone else who's actually free (not already tied
      // up on an ad-hoc task) heads to the emergency too, to help search for
      // more victims, instead of just radioing in that they're fine from
      // wherever they already were.
      onPhaseChange("reporting", "SELURUH UNIT TERSEDIA BERGERAK MEMBANTU PENCARIAN...");
      const busyRangerIds = new Set(
        Object.values(useTasksStore.getState().tasks)
          .filter((t) => t.status === "enroute")
          .map((t) => t.rangerId),
      );
      const backupNodes = RANGERS.filter((n) => n.id !== nearest.id && !busyRangerIds.has(n.id));

      for (const node of backupNodes) {
        if (cancelled) return;
        await wait(350);
        log({
          sender: `${node.name} (${node.callsign})`,
          color: "#e5e2e1",
          lead: "BERGERAK",
          body: "ikut menuju lokasi, membantu pencarian korban.",
        });
      }

      // Each backup unit scatters slightly around the epicenter (searching a
      // wider area, not stacking on the exact same spot) and glides there
      // independently, in the background — the main sequence below (arrival
      // push-in, calm-down) doesn't wait on them finishing.
      void Promise.all(
        backupNodes.map(async (node, i) => {
          const scatter: [number, number] = [
            epicenter[0] + (i % 2 === 0 ? 1 : -1) * 0.0009,
            epicenter[1] + (i % 3 === 0 ? -1 : 1) * 0.0009,
          ];
          const start = posOf(node);
          const backupRoute = (await fetchRoadRoute(start, scatter)) ?? buildFallbackRoute(start, scatter);
          if (cancelled) return;
          setBackupUnits((prev) => ({ ...prev, [node.id]: { pos: start, route: backupRoute } }));

          const durationMs = simulatedTravelDurationMs(backupRoute, 2500, 6000);
          await animateAlongRoute(
            backupRoute,
            durationMs,
            (pos) => {
              setBackupUnits((prev) => ({ ...prev, [node.id]: { pos, route: backupRoute } }));
              useTasksStore.getState().setRangerPosition(node.id, pos);
            },
            () => cancelled,
          );
          if (cancelled) return;

          setBackupUnits((prev) => ({ ...prev, [node.id]: { pos: scatter, route: [] } }));
          useTasksStore.getState().setRangerPosition(node.id, scatter);
          log({
            sender: `${node.name} (${node.callsign})`,
            color: "#5fb3b3",
            lead: "TIBA",
            body: "tiba di sekitar lokasi, membantu pencarian korban tambahan.",
          });
        }),
      );

      await wait(400);
      if (cancelled) return;

      // 7. Calm — alert stands down, but the search for the victim doesn't.
      // Route was already cleared back at arrival; this just clears the
      // other teams' evacuation-route overlays.
      map.flyToBounds(L.latLngBounds([[ranger.lat, ranger.lon], epicenter]), {
        padding: [80, 80],
        duration: 1.4,
      });
      setEvacRoutes([]);
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
        .filter((node) => node.id !== dispatchedId && !(node.id in backupUnits))
        .map((node) => (
          <Marker
            key={node.id}
            position={posOf(node)}
            icon={buildRangerIcon(`${node.name} · BT`)}
          />
        ))}

      {evacRoutes
        .filter((r) => r.rangerId !== dispatchedId)
        .map((r) => (
          <Polyline
            key={r.rangerId}
            positions={r.route}
            pathOptions={
              r.blocked
                ? { color: "#ff0040", weight: 2, opacity: 0.4, dashArray: "2 6" }
                : { color: "#5fb3b3", weight: 2, opacity: 0.35, dashArray: "4 8" }
            }
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
          icon={buildRangerIcon(RANGERS.find((n) => n.id === dispatchedId)?.name ?? "")}
        />
      )}

      {Object.entries(backupUnits).flatMap(([id, unit]) => {
        const node = RANGERS.find((r) => r.id === id);
        if (!node) return [];
        const layers = [];
        // Only the focused unit's route is drawn — with several units
        // moving at once, drawing every route at the same time would be a
        // tangle of waypoints. Click a unit to focus it (shows its route,
        // flies the camera in); click it again to un-focus.
        if (focusedId === id && unit.route.length > 1) {
          layers.push(
            <Polyline
              key={`${id}-route`}
              positions={unit.route}
              pathOptions={{ color: "#fabd00", weight: 2, opacity: 0.6, dashArray: "4 6" }}
            />,
          );
        }
        layers.push(
          <Marker
            key={`${id}-marker`}
            position={unit.pos}
            icon={buildRangerIcon(node.name)}
            eventHandlers={{
              click: () => {
                setFocusedId((prev) => (prev === id ? null : id));
                map.flyTo(unit.pos, 17, { duration: 1 });
              },
            }}
          />,
        );
        return layers;
      })}

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
    totalUnits: RANGERS.length,
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
              <TaskMarkers />
              <MessagePinMarkers />
              <EvacuationPointMarkers />

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
