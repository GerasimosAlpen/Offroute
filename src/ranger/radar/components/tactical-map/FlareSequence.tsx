import { useEffect, useState } from "preact/hooks";
import { Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { useCommsLogStore } from "@/store/commsLog";
import { useTasksStore, getRangerPosition } from "@/store/tasks";
import { useEvacuationRequestsStore } from "@/store/evacuationRequests";
import { type Ranger } from "@/lib/rangers";
import { useIncidents } from "@/hooks/useIncidents";
import { usePersonnel } from "@/hooks/usePersonnel";
import {
  fetchRoadRoute,
  buildFallbackRoute,
  metersBetween,
  animateAlongRoute,
  animateRouteReveal,
  simulatedTravelDurationMs,
  routeBlockedBy,
} from "@/lib/routing";
import { buildRangerIcon, VICTIM_ICON, EPICENTER_OFFSET } from "./mapIcons";

export type FlarePhase = "idle" | "detect" | "scan" | "dispatch" | "enroute" | "arrived" | "reporting" | "calm";

export interface FlareProgress {
  unitsDispatched: number;
  totalUnits: number;
  etaMs: number | null;
}

export const ACTIVE_DRILL_PHASES: FlarePhase[] = ["detect", "scan", "dispatch", "enroute", "arrived", "reporting"];

const TRAIL_LENGTH = 6;

/**
 * Owns the whole cinematic choreography: freeze-frame beat → detect → zoom
 * out to available rangers → pick nearest → animate them along a route
 * (leaving a comet trail, spawning a second victim partway through) →
 * arrive → other teams report in → settle to a calm-but-still-searching
 * state. Everything here (mesh peers, routing, "another victim") is
 * simulated — see TODO.md. Only the magnitude number is real (BMKG).
 */
export function FlareSequence({
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
  const { data: personnel = [] } = usePersonnel();
  const { data: hazards = [] } = useIncidents();
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
      // Wait for personnel to load before proceeding with flare logic
      if (personnel.length === 0) return;
      onProgress({ unitsDispatched: 0, totalUnits: personnel.length, etaMs: null });

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
      for (const node of personnel) {
        if (cancelled) return;
        setRevealedMesh((prev) => [...prev, node as unknown as Ranger]);
        bounds.extend(posOf(node as unknown as Ranger));
        await wait(420);
      }
      if (cancelled) return;
      map.flyToBounds(bounds, { padding: [64, 64], duration: 1.2 });
      log({
        sender: "SISTEM",
        color: "#5fb3b3",
        lead: "MESH",
        body: `${personnel.length} personel terdeteksi via bluetooth.`,
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

      const blockedRoadPositions: [number, number][] = hazards.filter((h) => h.kind === "blocked").map(
        (h) => [ranger.lat + h.offset[0], ranger.lon + h.offset[1]] as [number, number],
      );

      const allRoutes = await Promise.all(
        personnel.map(async (node) => {
          const from: [number, number] = posOf(node as unknown as Ranger);
          const r = (await fetchRoadRoute(from, epicenter)) ?? buildFallbackRoute(from, epicenter);
          return { rangerId: node.id, route: r, blocked: routeBlockedBy(r, blockedRoadPositions) };
        }),
      );
      if (cancelled) return;

      // Prefer an available (unblocked) route over a merely-shorter blocked one.
      const nearest = personnel
        .map((node) => {
          const pos: [number, number] = posOf(node as unknown as Ranger);
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

      const start: [number, number] = posOf(nearest as unknown as Ranger);
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
      onProgress({ unitsDispatched: 1, totalUnits: personnel.length, etaMs: travelDurationMs });

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
            totalUnits: personnel.length,
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
      onProgress({ unitsDispatched: 1, totalUnits: personnel.length, etaMs: 0 });
      log({ sender: senderName, color: "#5fb3b3", lead: "TIBA", body: "di lokasi. Memulai pencarian korban." });
      map.flyTo(epicenter, 18, { duration: 1, easeLinearity: 0.15 });
      setTrail([]);
      setRoute(null);
      setUnitPos(epicenter);
      useTasksStore.getState().setRangerPosition(nearest.id, epicenter);
      await wait(1400);
      if (cancelled) return;

      // 5b. Radar can't see the victim directly — the only realtime signal
      // is whatever the dispatched personel's own phone can pick up. This
      // stays simulated on purpose: see TODO.md's "Bluetooth — two tiers,
      // build tier 1 first" — real victim-as-beacon detection (Tier 2) needs
      // a native mobile peripheral/GATT-server role (Swift CoreBluetooth,
      // Kotlin BLE) that doesn't exist in Tauri, and iOS enforces a hard
      // OS-level restriction on background BLE advertising that no framework
      // can bypass. The real Tier 1 BLE relay (src-tauri/src/commands/
      // bluetooth.rs, src/store/bluetooth.ts) only covers desktop
      // central/client — it doesn't change what's simulated here.
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
      useEvacuationRequestsStore.getState().request(nearest as unknown as Ranger, epicenter, epicenter);

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
      const backupNodes = personnel.filter((n) => n.id !== nearest.id && !busyRangerIds.has(n.id));

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
          const start = posOf(node as unknown as Ranger);
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
          icon={buildRangerIcon(personnel.find((n) => n.id === dispatchedId)?.name ?? "")}
        />
      )}

      {Object.entries(backupUnits).flatMap(([id, unit]) => {
        const node = personnel.find((r) => r.id === id);
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
