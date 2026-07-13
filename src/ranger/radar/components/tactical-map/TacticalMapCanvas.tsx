import { useEffect, useState } from "preact/hooks";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import L from "leaflet";
import { Plus, Minus, LocateFixed } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useDeviceLocation } from "@/store/location";
import { useFlareStore } from "@/store/flare";
import { useCommsLogStore } from "@/store/commsLog";
import { useBmkgQuake } from "@/store/bmkg";
import { useTasksStore } from "@/store/tasks";
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
} from "@/lib/routing";
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
        if (task.route.length > 1) {
          layers.push(
            <Polyline
              key={`${task.hazardId}-route`}
              positions={task.route}
              pathOptions={{ color: "#66df75", weight: 3, dashArray: "10 8", className: "route-flow" }}
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
  const [evacRoutes, setEvacRoutes] = useState<{ rangerId: string; route: [number, number][] }[]>([]);
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
      setEvacRoutes([]);
      setVictim(null);
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
        bounds.extend([ranger.lat + node.offset[0], ranger.lon + node.offset[1]]);
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

      // 3. Dispatch — nearest team to the epicenter gets sent, but every
      // team's possible evacuation route gets computed and shown, not just
      // the chosen one.
      const nearest = RANGERS.reduce(
        (best, node) => {
          const pos: [number, number] = [ranger.lat + node.offset[0], ranger.lon + node.offset[1]];
          const d = metersBetween(pos, epicenter);
          return d < best.d ? { node, d } : best;
        },
        { node: RANGERS[0], d: Infinity },
      ).node;
      const senderName = `${nearest.name} (${nearest.callsign})`;

      onPhaseChange("dispatch", "MENGHITUNG SEMUA RUTE EVAKUASI YANG MUNGKIN...");
      log({
        sender: "PUSAT",
        color: "#66df75",
        lead: "RUTE",
        body: "menghitung seluruh kemungkinan rute evakuasi untuk semua tim.",
      });

      const allRoutes = await Promise.all(
        RANGERS.map(async (node) => {
          const from: [number, number] = [ranger.lat + node.offset[0], ranger.lon + node.offset[1]];
          const r = (await fetchRoadRoute(from, epicenter)) ?? buildFallbackRoute(from, epicenter);
          return { rangerId: node.id, route: r };
        }),
      );
      if (cancelled) return;

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
      log({
        sender: "PUSAT",
        color: "#66df75",
        lead: "RUTE DIKIRIM",
        body: `${allRoutes.length} rute evakuasi dihitung, dikirim ke seluruh tim.`,
      });
      await wait(500);
      if (cancelled) return;

      const start: [number, number] = [ranger.lat + nearest.offset[0], ranger.lon + nearest.offset[1]];
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
          setUnitPos(partial[partial.length - 1]);
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

      // 5. Arrived — tight cinematic push-in on the epicenter.
      onPhaseChange("arrived", `${senderName} TIBA DI LOKASI`);
      onProgress({ unitsDispatched: 1, totalUnits: RANGERS.length, etaMs: 0 });
      log({ sender: senderName, color: "#5fb3b3", lead: "TIBA", body: "di lokasi. Memulai pencarian korban." });
      map.flyTo(epicenter, 18, { duration: 1, easeLinearity: 0.15 });
      setTrail([]);
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

      // 6. Reporting — everyone else not dispatched checks in fine.
      onPhaseChange("reporting", "MENUNGGU LAPORAN SELURUH TIM...");
      for (const node of RANGERS.filter((n) => n.id !== nearest.id)) {
        if (cancelled) return;
        await wait(700);
        log({
          sender: `${node.name} (${node.callsign})`,
          color: "#e5e2e1",
          lead: "AMAN",
          body: "melanjutkan patroli, tidak ada temuan.",
        });
      }
      await wait(600);
      if (cancelled) return;

      // 7. Calm — alert stands down, but the search for the victim doesn't.
      // The route stays drawn until now (not cleared at arrival) so radar
      // can see the whole evacuation path that was actually taken.
      map.flyToBounds(L.latLngBounds([[ranger.lat, ranger.lon], epicenter]), {
        padding: [80, 80],
        duration: 1.4,
      });
      setRoute(null);
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
        .filter((node) => node.id !== dispatchedId)
        .map((node) => (
          <Marker
            key={node.id}
            position={[ranger.lat + node.offset[0], ranger.lon + node.offset[1]]}
            icon={buildRangerIcon(`${node.name} · BT`)}
          />
        ))}

      {evacRoutes
        .filter((r) => r.rangerId !== dispatchedId)
        .map((r) => (
          <Polyline
            key={r.rangerId}
            positions={r.route}
            pathOptions={{ color: "#5fb3b3", weight: 2, opacity: 0.35, dashArray: "4 8" }}
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
