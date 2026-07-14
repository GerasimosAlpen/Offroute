# TODO

Split three ways: **Backend** (NestJS server in `_server/`), **Backend
(Tauri)** (native Rust/Tauri-side work), and **Frontend** (Preact UI).

**Correction, 2026-07-14: the "Backend: none of it exists yet" framing below
was true when first written but is now stale — a real NestJS + Prisma +
Postgres (Supabase-hosted) backend exists, with REST endpoints, a Socket.IO
gateway, and a seed script, built by a collaborator (`GerasimosAlpen`,
PRs #8/#9). `CLAUDE.md`'s "Prisma schema currently empty" claim is similarly
outdated. See "Radar ↔ backend wiring pass" further down for the current,
verified state of what's actually connected vs. still simulated — that
section is the accurate one; treat the rest of this "Backend (NestJS)"
section as historical context for *why* things are shaped the way they are,
not as a statement of current reality.

---

# Backend (NestJS)

## Realtime personel tracking & tasking — now built, see wiring pass below

The task/assignment model, WS gateway, and REST endpoints described in this
subsection (as of 2026-07-14) all exist: `_server/src/tasks`, `_server/src/
gateway/events.gateway.ts`, `_server/prisma/schema.prisma`'s `Task` model.
Kept below for the original reasoning; skip to "Radar ↔ backend wiring pass"
for what's actually wired up on the frontend today.

- **Task/assignment model** — a personel can *take* a task (an incident, a
  minor hazard, a FLARE dispatch) which should be a real assignment record,
  not implicit. Needs: `Task` (or reuse `Report`/`Incident` per README's
  planned model) with a `assignedTo` personel + status (open/taken/en
  route/on scene/done).
- **Realtime location broadcast for on-task personel** — once a task is
  taken, that personel's live position needs to stream to radar over the
  WebSocket gateway (README phase 3; `socket.io-client` already installed on
  frontend for this). This generalizes what the FLARE sequence fakes today
  (a single hardcoded "nearest mesh node" moving along a route) to: *any*
  personel, on *any* accepted task, tracked live.
- **Personel status messages, geotagged** — personel sends a free-text
  status/report; needs `{ senderId, text, lat, lon, timestamp }` over the WS
  gateway. This is what lets the message "ping their last location on the
  map" (see Frontend section) — the backend just needs to carry the
  coordinates alongside the message, nothing fancy.
- **Lapor Incident report endpoint** — REST + `Report`/`Incident` model
  (README phase 2/3). `MOCK_HAZARDS` in `TacticalMapCanvas.tsx` (fire,
  crash, theft, etc.) are hardcoded offsets standing in for this.
- **FLARE broadcast persistence** — right now "Mode Flare" only sets local
  Zustand state (`src/store/flare.ts`); a real major-incident declaration
  should hit the backend so it's not just a client-side toggle.

## Radar ↔ backend wiring pass (2026-07-14) — audited + completed what was frontend-only

Audited every backend controller/service/gateway event against every
frontend call site to answer "is radar actually realtime, or is the backend
just sitting there unused?" Answer: **hybrid** — some channels were fully
live, several had the backend half built with nothing calling it, one had
the frontend half built with no backend route to hit. Fixed everything that
was fixable from the frontend side alone (no `_server` changes — that's
listed separately below for the collaborator to pick up):

**Already fully wired before this pass (left alone):** FLARE alerts
(`POST /flare/activate` ↔ `flare-broadcast`), message pins (`POST /messages/
pin` ↔ `message-pin`), personnel roster, incidents list (REST, polled),
task assign/arrive (`POST /tasks/assign`, `PATCH /tasks/:id/status`),
evacuation request/accept/reject (REST only, no realtime fan-out — until
now).

**Added in this pass, all in `src/`, no backend changes:**
- `src/store/tasks.ts` — `loadTasks()` hydrates in-progress/resolved tasks
  from `GET /tasks` on app start (previously never called — a page reload
  forgot every task that wasn't this tab's own). The live glide now also
  streams position to `POST /tasks/:id/position` every ~400ms during transit
  (throttled — was never called at all before, so that endpoint and its
  `ranger-position` broadcast were dead code). Subscribed to `task-update`
  and `ranger-position` so a second radar client sees another client's
  dispatches and positions move, not just its own — guarded by a
  `locallyDrivenHazards`/`locallyDrivenRangers` set so a client doesn't treat
  the echo of its *own* broadcast as a remote update and fight its own
  smooth local animation.
- `src/store/evacuationPoints.ts` — `loadPoints()` hydrates confirmed points
  from `GET /evacuation/points` on start (previously never called — a
  confirmed point vanished on reload, only ever reflecting what *this* tab
  itself had just accepted). Subscribed to `evac-confirmed` for cross-client
  sync.
- `src/store/evacuationRequests.ts` — `loadPending()` hydrates pending
  requests from `GET /evacuation/pending`. Subscribed to `evac-request` so
  another client's incoming ping shows up here too, not just ones this tab
  itself triggered.
- `src/hooks/useIncidents.ts` — subscribed to `incident-new` (module-level,
  registered once) to invalidate the TanStack Query cache instantly instead
  of waiting on the existing 30s poll.
- `src/App.tsx`'s `AppInit` now calls all of the above `load*()` functions
  alongside the existing `loadFlareState()`/`loadPins()` calls.
- **Hardening pass**: every socket listener (the ones just added, and the
  three pre-existing ones in `commsLog.ts`/`messagePins.ts`/`flare.ts`) now
  guards against a null/malformed payload before touching its fields, so a
  bad broadcast logs a warning instead of throwing inside the listener.

**Backend gaps found — need the collaborator, not fixable from the frontend
alone:**
- **No `POST /comms` route.** `_server/src/comms/comms.service.ts` has a
  fully-working `append()` method (persists a `CommsEntry`, emits
  `comms-message`) but `comms.controller.ts` only exposes `GET /comms/
  history` — nothing ever calls `append()`. Result: the frontend's
  `comms-message` listener (`src/store/commsLog.ts`) is live code waiting on
  an event that can never fire. Every comms-log line the radar UI shows
  today (task acceptance, arrival, evac request/accept/reject) is generated
  by `useCommsLogStore.getState().append()` and stays purely local to that
  browser tab — it never reaches the backend or other clients. Needs a
  `POST /comms` (or similar) route wired to the existing `append()` before
  this can be made real.
- **`LaporIncident.tsx` (radar's incident-report page) is still a pure UI
  mock** — hardcoded history list, no state wired up, and its "KIRIM
  LAPORAN" submit button has no handler at all. Beyond just adding a submit
  handler: this page's own `IncidentType` (`fire | flood | quake | landslide
  | other`) doesn't match the backend's `HazardKind` enum (`fire | blocked |
  medical | crash | theft`) — same app, two disconnected incident
  taxonomies, one of them (`HazardKind`, in `src/lib/hazards.ts`) already
  used everywhere else and matching the backend exactly. This needs a
  product decision (which taxonomy wins, or do both need to coexist) before
  it's wired, not just a mechanical `incidentsApi.create()` call.
- **`EventsGateway` is provided per-module** (separately in `comms`,
  `evacuation`, `flare`, `incidents`, `messages`, `tasks` — six providers of
  the same class, no shared `GatewayModule` exporting one instance).
  Probably harmless for `.emit()` broadcasting today, but not how Nest
  gateways are meant to be shared, and `handleConnection`/`handleDisconnect`
  fire once per module per client. Worth a cleanup pass.
- **Uncommitted local diff in `_server/prisma/schema.prisma`** plus an
  untracked `_server/bun.lock` were sitting in the working tree when this
  audit ran — worth reconciling/committing (or discarding, if stray) before
  either of you relies on `main` matching what's actually running.

**Known limitation, not fixed in this pass:** `src/store/tasks.ts`'s
`assign()` still looks up hazards/rangers from the static `HAZARDS`/`RANGERS`
constants (`src/lib/hazards.ts`, `src/lib/rangers.ts`), not from the live
`useIncidents()`/`usePersonnel()` query data the UI actually renders. This
works today only because `_server/prisma/seed.ts` deliberately seeds
matching ids (`"bravo"`, `"a01"`, etc.) — so it's not visibly broken, but a
**new** incident (once `POST /incidents` is actually reachable from
somewhere) wouldn't be dispatchable via "Kirim Unit", since `assign()`'s
`HAZARDS.find()` would never find it. Fixing this properly means threading
the live `hazards`/`personnel` query results into `assign()` from its call
site (`HazardStatusPanel.tsx`) instead of importing the static arrays
directly inside the store.

## BMKG weather — needs an adm4 lookup

BMKG's forecast API (`api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<code>`) is
reachable, but needs a kelurahan-level `adm4` code — no coordinate→adm4
lookup exists in this app, and Indonesia has thousands of these codes.
**Don't hardcode one region** (e.g. always Jakarta) regardless of the
ranger's real position — geographically dishonest, same problem noted below
for the FLARE drill's epicenter. Needs a real lookup dataset/service (could
be a small self-hosted lookup table, or a geocoding-to-adm4 API if one
exists) before this is worth building.

## Routing — move off the OSRM demo server before shipping

`fetchRoadRoute()` (in `TacticalMapCanvas.tsx`) calls
`router.project-osrm.org` — OSRM's public **demo** server, free/keyless,
real road-snapped routes, but rate-limited and explicitly "not suitable for
production" per OSRM's own usage policy. Before shipping: self-host OSRM, or
move to a paid routing API (GraphHopper, Mapbox, etc.). Also still
fully online-only — see the offline routing note under Backend (Tauri).

---

# Backend (Tauri / Rust)

## Native device location — deferred (disk/build issues, see history)

Removed after causing macOS link failures and burning a lot of disk space
mid-session. Browser Geolocation (`src/store/location.ts`) is the only
location source again, same as before this was attempted.

**Why native was wanted:** Tauri's webview Geolocation API is unreliable
across platforms; the plan was a real Tauri command (`get_device_location`)
backed by the actual OS location service per platform, mirroring
`get_battery_status`/`get_network_status` in
`src-tauri/src/commands/system_status.rs`.

**What was learned, per platform — reuse this before re-researching:**

- **macOS** — `corelocation-rs` (crates.io), feature `"async"`,
  `corelocation::async_api::LocationManagerStream` + `LocationManagerEvent`.
  Verified it actually compiles. Needs:
  - `NSLocationWhenInUseUsageDescription` in a `src-tauri/Info.plist` (merged
    into the bundle automatically), or the OS permission prompt never appears.
  - `MACOSX_DEPLOYMENT_TARGET` raised to at least `12.0` — the crate's Swift
    bridge uses Swift Concurrency, and Rust's default deployment target on
    Apple Silicon (11.0) forces Swift to link back-deployment compatibility
    shims (`swiftCompatibility56`/`Concurrency`/`Packs`) that only ship with
    full Xcode, not Command Line Tools. Set via
    `src-tauri/.cargo/config.toml` → `[env] MACOSX_DEPLOYMENT_TARGET = "12.0"`.
    Also bump `tauri.conf.json` → `bundle.macOS.minimumSystemVersion` to match.
  - Do this on a machine with headroom — the Swift bridge build products are
    large (ate multiple GB of `target/debug` during dev).
- **Linux** — `geoclue-zbus` crate, real GeoClue2 D-Bus flow, method names
  confirmed by generating its docs locally (`ManagerProxy::get_client`,
  `ClientProxy::start`/`receive_location_updated`,
  `LocationProxy::latitude`/`longitude`/`accuracy`). **Never actually run** —
  no Linux box to test on. Also **GPL-2.0-or-later** licensed, unlike every
  other dependency in this project — check that's acceptable before shipping.
- **Windows** — blocked. `windows` crate + `Devices_Geolocation` feature hit a
  compile error in a transitive dep: `windows-future` referencing
  `windows_threading::submit`, which didn't exist in the resolved version.
  Didn't get to root-cause whether that's a real bug or a version pin issue —
  start there next time.

**Before retrying:** check `df -h` first. A full corelocation-rs build alone
used several GB of `target/debug`; doing all three platforms' worth of
research in one session is what caused the disk-space scare partway through
this work.

## Cross-platform WiFi signal strength — verify Windows/Linux

`get_network_status` in `src-tauri/src/commands/system_status.rs` has real
Windows (`netsh wlan show interfaces`) and Linux (`/proc/net/wireless`)
branches, but only the macOS one has actually been run. Verify on real
Windows/Linux machines before relying on it.

## Bluetooth — two tiers, build tier 1 first

Both tiers sit on top of the Bluetooth research spike already flagged in
`CLAUDE.md` (no official Tauri Bluetooth plugin exists; needs a custom Rust
module, e.g. `btleplug`).

**Tier 1 (guaranteed floor, build this first):** plain Bluetooth data/text
communication between personel↔personel and personel↔radar when internet is
down — the original README requirement. Both ends have the app open,
Bluetooth on, exchanging structured messages (status updates, GPS pings,
short text) over a direct BLE GATT connection or classic Bluetooth serial.
Normal foreground BLE — doesn't fight iOS's background restrictions the way
tier 2 would. `btleplug` gives real cross-platform BLE support for this on
desktop (radar, and personel if it ends up desktop too).

**Tier 2 (stretch goal, layered on top of tier 1, not a prerequisite for
it):** victim/personel phone-as-beacon when buried/stuck with zero
internet. Same problem shape as Apple's Find My network / Android's Find My
Device network (anonymized BLE beacon + opportunistic relay by any nearby
device), avalanche transceivers (constant beacon + RSSI "warmer/colder"
search), and disaster-mesh apps like Bridgefy/goTenna (multi-hop
store-and-forward with no infrastructure up).

Layered approach if tier 2 gets built:
1. **Victim/personel phone, "beacon mode"** — on losing connectivity (or
   manual SOS), broadcast a low-power BLE advertisement (rotating anonymized
   ID + last GPS fix + battery %), screen off. This is a peripheral/
   advertising role, not scanning.
2. **Rescuer (personel) phone, continuous scan** — background BLE central
   role, logs beacon sightings with RSSI + timestamp, surfaces a
   "closer/further" search UI. This is what "radar asks personel if their
   phone detects the victim's signal" (simulated in the FLARE sequence
   today) would actually be asking about.
3. **Store-and-forward relay to radar** — if personel is also offline,
   "found beacon X near Y" hops device-to-device over the same mesh until it
   reaches connectivity. Delay-tolerant, not realtime.

**Tauri-specific reality check:**
- Desktop-side BLE central (`btleplug`) is genuinely feasible with what's
  already identified — covers tier 1 and the scanning half of tier 2.
- True phone-in-pocket beaconing (broadcasting, tier 2 step 1) is
  mobile-only: no official Tauri Bluetooth plugin exists for peripheral mode
  on iOS/Android — needs a custom native plugin (Swift/CoreBluetooth on iOS,
  Kotlin BLE APIs on Android). Real engineering work.
- **iOS enforces hard platform restrictions on background BLE
  advertising/scanning that no framework can bypass** — an Apple policy
  limit, not a Tauri gap. Android is more permissive but still has
  background-execution limits (Doze mode, since Android 8).
- Tauri v2 does support compiling to iOS/Android — worth factoring into the
  still-open personel platform decision — but that doesn't mean a Bluetooth
  beacon plugin exists ready to use. It doesn't.
- **Web Bluetooth is not an option** for tier 2 — central/scanning only,
  never peripheral/advertising, and unavailable in iOS WKWebView regardless.

## Personel hardware-safety mode — blocked on the platform decision

Requested: when a personel is in danger, engage the phone's hardware
(flashlight, vibration, alarm sound, SOS/location beacon) to help
find/protect them, on top of just showing their position on radar's map.

Entirely personel-side (phone) work. Per `CLAUDE.md`'s existing roadmap
note, **personel UI hasn't started at all** — blocked on deciding whether
"phone version" means a separate mobile target or a web view, since this
repo is a Tauri *desktop* app. Nothing to build on the radar side for this;
don't fake hardware-control UI on the desktop map, since the desktop has
none of the phone's hardware to control. Revisit once the personel platform
decision is made.

## Offline routing (Dijkstra) — deferred, not scoped

README's own routing phase: Dijkstra over a local node graph (Rust,
`petgraph`) for when there's no internet for OSRM/GraphHopper. Not scoped
yet — depends on the node-graph data model existing first (also not built).

---

# Frontend

## Tactical Map — real Leaflet map, mock data underneath, real behavior on top

`TacticalMapCanvas.tsx` renders a real Leaflet map (`react-leaflet`, CARTO
dark basemap) centered on the ranger's actual GPS position. Once the backend
items above exist, wire:
- Other rangers' positions → a `<Marker>` per personel, updated as location
  events arrive over the WS gateway (see `TODO(backend)` comment above
  `SELF_ICON` in `TacticalMapCanvas.tsx`).
- `src/lib/hazards.ts` (`HAZARDS`) → replace with real incident coordinates
  from the Lapor Incident endpoint.

**Hazard data unified**: `HAZARDS` (`src/lib/hazards.ts`) and `RANGERS`
(`src/lib/rangers.ts`) are now single shared sources — the Status Taktis
sidebar panel and the map markers used to be two disconnected mock lists
that didn't refer to the same incidents/people. Fixed as part of building
task assignment below, since "assign a ranger to a hazard" doesn't make
sense if the two views disagree on what a hazard even is.

## Personel map routing now shares radar's real routing engine — built

`PetaTaktis.tsx` (personel's tactical map) used to fake navigation entirely:
distance was a hand-rolled flat-earth calc duplicating `metersBetween`, the
three route options (fastest/moderate/safest) were arbitrary time/distance
multipliers with no real geometry, and picking one just set UI state — no
polyline was ever drawn (the comment literally said `// In production:
trigger OSRM routing & draw polyline`). `src/lib/routing.ts` was already a
plain shared module (no radar-only state), just never imported here.

Now personel imports the same functions radar uses to dispatch units —
`metersBetween`, `fetchRoadRoute`, `buildFallbackRoute`, `animateRouteReveal`
— so both roles run on one routing engine instead of two divergent ones.
Selecting a route option fetches a real OSRM road-snapped path from the
ranger's GPS position to the incident (falling back to the bezier-curve
approximation if OSRM's unreachable), draws it progressively via
`animateRouteReveal`, and renders it as a `<Polyline>`. A `routeToken` ref
guards against a stale reveal (from a route the operator already abandoned)
overwriting a newer one if routes are switched quickly.

Still simulated/left for later: the three route *options* shown before
selection remain synthetic multipliers on straight-line distance rather than
three actually-distinct OSRM routes (OSRM's free demo endpoint doesn't do
alternatives cleanly) — only the one actually picked gets a real path.

**"Route search" cinematic — purely a visualization, not a routing
algorithm.** The real OSRM fetch is usually sub-second, which read as an
instant snap with nothing communicated. Picking a route option in
`PetaTaktis.tsx` now runs a multi-beat sequence, built to read as "the
algorithm is doing real, fast, thorough work" on a screen small enough that
it also has to double as reassurance for the crew member about to move:

1. **Scan** — camera zooms *out* (`map.flyToBounds`) to frame the whole area
   between the ranger and the incident.
2. **Generate** — `CANDIDATE_COUNT` (8) distinct candidate paths spread across
   a `bend` range (see `buildFallbackRoute`'s new `bend` param in
   `src/lib/routing.ts`) all fill in at once, staggered like a wave via
   `animateRouteReveal`, each colored differently and each carrying invented
   distance/time/risk/terrain stats (`buildCandidates`). The real
   `fetchRoadRoute` call fires in parallel here, not awaited yet.
3. **Evaluate** — a sort-visualizer-style sweep steps through every
   candidate one at a time, flashing its stats into the HUD and dimming it
   unless it's the new "best so far" (lowest fake weighted score).
4. **Winner** — camera pushes *in* tight on the winning candidate's bounds.
5. **Contingency** — a fixed checklist of field scenarios (road blocked,
   landslide, GPS lost → offline/Bluetooth fallback, new danger zone, bad
   weather) ticks past with a simulated "covered" result each, so the crew
   sees likely failure modes acknowledged before they move — this part is
   pure UI, nothing here actually reads live GPS/hazard state yet.
6. **Resolve** — the winning candidate is swapped for the real OSRM/fallback
   geometry that finished fetching back in step 2, and the normal solid
   route line + "NAVIGASI AKTIF" banner take over.

None of the candidate scoring, terrain/risk labels, or scenario outcomes are
real — only the final destination and the swapped-in real route geometry
are. Documented here so this doesn't get mistaken for actual routing logic
later. The whole component (`RouteSearchSequence` in `PetaTaktis.tsx`) is
keyed by `runId` so picking a new route mid-sequence fully remounts and
cancels the old one via its effect cleanup, same cancellation pattern as
`FlareSequence` on the radar side.

## Personel map: starting point, live tracking, heading rotation — built

Several related fixes/additions to `PetaTaktis.tsx`, all in service of "always
know where the crew started, where they are now, and (if the device can tell
us) which way they're facing":

- **Starting point vs. live position, split.** Previously every hazard marker
  was positioned as an offset from the *live* GPS position, so hazards would
  visibly drift around the map as the ranger walked — clearly wrong, hazards
  are fixed real-world locations. Now `startPos` is captured once, from the
  first real GPS fix, and never changes; hazard positions (`EVENTS`) and the
  route-search cinematic's origin are anchored to `startPos`. The live
  position (`userPos`, from `useDeviceLocation()`) still updates on every GPS
  fix as before, driving only the moving `SELF_ICON` dot — a fixed blue flag
  (`START_ICON`) now separately marks where the crew actually started.
- **Intro cinematic.** The very first time a GPS fix lands, `IntroSequence`
  (mounted inside `<MapContainer>` for `useMap()` access) sets the view wide
  (zoom 12) then flies in to `startPos` at zoom 16 over 1.6s — an establishing
  shot, so the map never just silently appears already zoomed into a
  coordinate with no context.
- **Live-follow during navigation.** `LiveFollow` pans the camera to the live
  `userPos` (throttled to actual GPS fix cadence, not polled) whenever
  `activeRoute` is set and the search isn't still running — so once
  navigating, the crew's dot moving is something visibly tracked by the
  camera, not something you have to go hunt for on the map.
- **Device-heading map rotation — best-effort, untested on real hardware.**
  There is no dedicated Tauri compass/magnetometer plugin (see AGENTS.md's
  plugin table — only `tauri-plugin-os` exists, for platform/OS info, not
  sensors), so `src/store/heading.ts` feature-detects the standard web
  `DeviceOrientationEvent` API instead — it may or may not fire depending on
  what the underlying webview exposes (WKWebView on iOS/macOS often does;
  WebView2/WebKitGTK on Windows/Linux typically don't). `startHeadingWatch()`
  is called from the first "Navigasi" tap specifically because iOS 13+
  requires `requestPermission()` to originate from a real user gesture.
  When a heading *is* available, the map's container is CSS-rotated
  (`rotate(calc(-1 * var(--map-heading)))`) so "up on screen" tracks the
  direction the phone is facing, nav-app style; every marker counter-rotates
  by the same CSS var (inherited, so no icon HTML needs regenerating per
  heading tick) to stay upright and legible. The rotated container is
  oversized to 150%/centered so corners don't expose blank map outside the
  viewport when rotated. When heading is unavailable (the expected case on
  most desktop/Windows/Linux webviews), none of this activates — it's a
  plain north-up map with just the zoom in/out cinematic, exactly the
  specified fallback. **Not verified against a real device/sensor** — no
  hardware available in this environment to test against; verify on an
  actual phone build before relying on it.
- **Event detail card no longer lingers over the map after navigating.** Bug:
  `EventPopup` was shown whenever `selectedEvent && !showRouteSheet` — which
  became true again the instant a route was picked (since `showRouteSheet`
  resets to `false`), leaving the bottom detail card + "NAVIGASI" button
  sitting over roughly a third of the screen during the search cinematic and
  the subsequent navigation. Now also gated on `!searching && !activeRoute`,
  so picking a route collapses that card and the full map is visible.

## Realtime task-based ranger tracking + smooth glide — built

"Budi takes the crash task" now works for any hazard, not just the FLARE
drill: `src/store/tasks.ts` picks the nearest free ranger, fetches a real
OSRM route, and glides them there. `HazardStatusPanel.tsx` has a **Kirim
Unit** button on every hazard (not just the one "critical" one before) that
triggers `useTasksStore.assign(hazardId, rangerCoords)`; the panel shows live
status ("Budi (TIM BRAVO) menuju lokasi..." → "...tiba di lokasi") once
assigned. `TacticalMapCanvas.tsx`'s `TaskMarkers` renders the moving unit +
route for every active task.

**Smooth glide, done properly:** `animateAlongRoute()` in `src/lib/routing.ts`
is `requestAnimationFrame`-driven, interpolating continuously by real elapsed
time and distance along the route — not the old fixed-tick jump-between-
resampled-points approach. `FlareSequence`'s own movement was rewritten to
use the same helper, so both systems glide identically. Same file also has
`animateRouteReveal()` (see below) — both are generic, reusable for any
future realtime-tracked marker, not just these two features.

**Route draws itself, doesn't just appear:** `animateRouteReveal()` traces
the polyline from start to end over ~900ms (via `sliceRouteByProgress()`)
before travel begins, in both the ad-hoc task flow and the FLARE sequence.

**Ranger names, not just callsigns:** `RANGERS` in `src/lib/rangers.ts` now
has real first names (Budi/Siti/Andi/Dewi) alongside the existing "TIM
BRAVO"-style callsigns, specifically so comms log/status text can say "Budi
(TIM BRAVO)" — matches how the feature was actually asked for.

**Minor incidents stay quiet, not catchy:** ad-hoc task routes
(`TaskMarkers` in `TacticalMapCanvas.tsx`) dropped the bright flowing
`route-flow` dash animation for a thin, dim, static line (`weight: 1.5,
opacity: 0.4`) — a house fire or a theft report shouldn't visually compete
with an actual earthquake drill. `FlareSequence`'s own route keeps the
bright/animated treatment; that's the one emergency worth being loud about.

Still simulated: no real task/assignment backend (see Backend section) —
`assign()` picks the nearest ranger locally and that's it, nothing is
persisted or broadcast. Real version needs the backend task model + WS
broadcast described above.

## All-available-units search assist + focus/un-focus — built

Previously only the single nearest ranger actually moved during a FLARE
drill; everyone else just radioed in "fine, continuing patrol" from wherever
they already were. Now every ranger who's free (checked against
`useTasksStore`'s live `tasks`, same `status === "enroute"` busy-check as
`assign()` uses) gets sent toward the epicenter too, to help search for more
victims — each scattered to a slightly different point around it (not
stacked on the exact same spot) via a small per-unit offset, gliding there
with the same `fetchRoadRoute`/`animateAlongRoute` engine as everything else.
Dispatch happens in the background (`void Promise.all(...)`, not awaited) so
the main drill sequence doesn't stall waiting for every backup unit to
arrive — their own arrival logs land in Comm Center independently, even
after the alert has already gone calm.

**Focus/un-focus, so it doesn't turn into a tangle of waypoints:** with
several units moving simultaneously, drawing every one's route line at once
would be unreadable. So backup units only ever show as a marker by default —
clicking one sets it as the sequence's single `focusedId`, which reveals
*its* route and flies the camera in; clicking the same unit again clears the
focus (hides the route, no camera move). Only one route shown at a time,
picked by the operator — this is the "which one can we choose to show"
behavior. The primary dispatched unit's route is unaffected by this and
still always shows during its own travel, same as before.

### Three real bugs found and fixed here — same mistakes to avoid in the real backend

Genuine logic bugs (the first two in `src/store/tasks.ts`, the third
spanning it and `FlareSequence`), not just simulation gaps — exactly the
kind of thing to get right the first time when the real task/assignment
backend gets built (see Backend section above):

1. **"Busy" never cleared.** `assign()` originally computed which rangers
   were unavailable from *every* task that had ever existed, regardless of
   status — so a ranger who'd already arrived and finished stayed
   permanently "busy" and could never be assigned again. Fixed by only
   counting tasks with `status === "enroute"` as making a ranger
   unavailable. **Backend equivalent: a ranger's availability must be
   derived from their current/active assignment state, never from a growing
   historical log of past assignments** — if the real API models this as
   "does this ranger have any assignment record," it'll have the same bug.
2. **New tasks started from a stale position.** `assign()` always
   recomputed a ranger's starting point from their static home offset
   (`RANGERS[i].offset`), so a ranger sent on a second task would visually
   teleport back to their original spot instead of starting from wherever
   their first task actually left them. Fixed with `rangerLastKnownPos`, a
   separate map updated continuously (not just on arrival) and consulted
   first when picking a start position. **Backend equivalent: dispatch
   logic must query the ranger's latest known real-time position, never a
   cached/static "home" location** — this is exactly the kind of bug that's
   invisible in a demo with one task at a time and only shows up once
   someone takes a second assignment, so it's worth testing explicitly.
3. **Two systems, two disagreeing ideas of "where is ranger X."** The FLARE
   drill (`FlareSequence`, inside `TacticalMapCanvas.tsx`) computed every
   ranger's position purely from their static `RANGERS[i].offset`, never
   consulting `rangerLastKnownPos` — so a ranger already moved by an ad-hoc
   "Kirim Unit" task would appear to teleport back to their original spot
   the moment FLARE fired, FLARE's own "nearest ranger" pick would be wrong
   (picking someone far away over someone who'd literally just finished a
   task next door), and clicking FLARE used the ranger's old position
   instead of wherever they actually were. Fixed by exporting
   `getRangerPosition(rangerId, fallback)` and a `setRangerPosition(rangerId,
   pos)` action from `src/store/tasks.ts`, and having `FlareSequence` read
   through a local `posOf()` wrapper (instead of raw offset math) everywhere
   it used to compute a ranger's position, plus write back into the same
   store on every reveal/travel tick and on arrival. Also moved the route
   clear from the "calm" phase to the moment of arrival, so a finished
   FLARE-dispatched unit's route disappears immediately instead of staying
   drawn — matching how `tasks.ts` already behaved for ad-hoc assignments.
   **Backend equivalent: "current ranger position" must be ONE piece of
   state with one owner, read by every feature that dispatches or displays
   rangers — never let a second feature (a drill mode, an admin override,
   whatever) maintain its own parallel idea of where someone is.** Two
   independent systems computing "current position" from different sources
   of truth will silently disagree the moment a ranger's real position
   diverges from either one's assumed starting point.

A related, deliberate design split introduced while fixing #1: `tasks`
(live, cleared once a ranger moves to a new job) vs. `resolvedHazards`
(permanent record of who resolved what, in `src/store/tasks.ts`) — needed so
that clearing a stale live-position marker doesn't also erase the sidebar's
memory that a hazard was already handled. The real backend will need the
same split: "current live assignment" and "historical resolution record"
are different data, not the same table queried differently.

## Evacuation points — ranger-pinged safe zones, built (simulated)

Reworked from a one-click radar-side button into an actual request/response
flow, and scoped to major emergencies only:

- **Personel side (`src/store/evacuationRequests.ts`), "if they want to":**
  a ranger *offers* their current position as a safe evacuation point — not
  automatic, their call. Only fires from `FlareSequence` (major emergency —
  earthquake/tsunami/typhoon drill), never from the ad-hoc minor-hazard task
  system (`HazardStatusPanel.tsx` no longer has any evac-point action at
  all — status text only). No personel app exists yet, so the request is
  simulated at the point in the drill where the dispatched ranger would
  plausibly make that offer; a real personel client would trigger `request()`
  from an actual button tap.
- **Radar side:** the offer shows as a pending card (bottom-right of the map,
  `TacticalMapCanvas.tsx`) with **Terima**/**Tolak** (accept/reject). Reject
  just dismisses it and logs the refusal. Accept calls into
  `src/store/evacuationPoints.ts` → `mark()`, which pins the safe-zone marker
  and draws + animates a real route from the incident to that point (reusing
  `animateRouteReveal`, same as everything else), logged to Comm Center.

## Route availability — "which one can they actually take"

`FlareSequence`'s "every possible evacuation route" (built last round) now
actually checks availability instead of just showing every route as equally
viable: `routeBlockedBy()` in `src/lib/routing.ts` checks whether a
candidate route passes within 60m of a known `blocked`-kind hazard (the
`JALUR PUTUS` one). Blocked routes render in red/dashed instead of the
default dim teal, and the dispatch logic now prefers an *available* route
over a merely-shorter blocked one when picking who to send. Comms log
reports how many of the computed routes were blocked.

**Still a proximity heuristic, not real road-network awareness** — it
checks distance-to-hazard-point along the route, not "does this specific
road segment pass through the blockage." Good enough for the demo's scale;
a real version needs actual road-graph knowledge (ties into the offline
routing/Dijkstra note in the Backend (Tauri) section).

## Personel status messages as map pins — built (simulated trigger)

A personel status message shows up **both** in the Comm Center log (real,
shared store — `src/store/commsLog.ts`) **and** as a pin on the tactical map
at wherever they were standing when they "sent" it
(`src/store/messagePins.ts` → `MessagePinMarkers` in `TacticalMapCanvas.tsx`,
clickable to a popup with the message + sender + time).

**What's simulated:** there's no real personel phone app to actually send a
message from, so the trigger is automatic — `useTasksStore.assign()` posts
one on arrival (`arrivalReportFor()` in `src/lib/hazards.ts` picks flavor
text by hazard kind: fire → "api berhasil dikendalikan," crash → "korban
sudah dievakuasi," etc.). Real version needs the backend geotagged-message
work above (`{ text, lat, lon, timestamp }` per message over the WS
gateway) feeding this same store instead of the local `assign()` call.

**Not decided yet:** do message pins persist forever as a history layer
(maybe toggleable), or fade/expire after some time? Currently they just
accumulate forever in `useMessagePinsStore` — fine for a demo, not for
real use with more than a handful of messages.

## All possible evacuation routes, shown together

Requested: during an emergency, don't just show the one chosen route — show
every route radar could send a team down, so radar can watch everything and
make the call. `FlareSequence`'s dispatch phase now fetches a real OSRM
route from **every** ranger's position to the epicenter in parallel, shows
all of them as dim/thin lines (`evacRoutes` state), logs "N rute evakuasi
dihitung, dikirim ke seluruh tim," and *then* highlights + travels the
chosen (nearest) one brightly on top. All routes stay visible until the
drill reaches "calm."

**Still simulated**, same caveats as the routing note in the Backend
section (OSRM demo server, no real routing algorithm) — this is just "ask
OSRM N times instead of once and show them all," not a real
multi-route-optimization system.

**Route reveal, made catchier:** the dim routes cascade in one at a time
(staggered ~130ms apart, each tracing over ~650ms) instead of popping in
together. The chosen route's ranger marker now leads the drawing tip while
it traces (`unitPos` follows the reveal's leading point in both
`FlareSequence` and `src/store/tasks.ts`), so it reads as "scouting the path
live" rather than a line appearing next to a stationary icon.

## FLARE / dispatch sequence — fully simulated, real routing underneath

The sidebar "Mode Flare" button (`FlareButton.tsx` → `src/store/flare.ts`)
drives a scripted sequence in `FlareSequence` (inside
`TacticalMapCanvas.tsx`): detect (shake + flash + flyTo epicenter) → scan
(zoom out, reveal mesh nodes) → dispatch (pick nearest team, draw a route,
log "RUTE DIKIRIM") → en route (animate along the route, leave a comet
trail, spawn a second "victim" partway through, log a proximity update) →
arrived (tight push-in, then radar asks if the personel's device detects the
victim's signal, personel answers with a distance or "nihil") → reporting
(everyone else checks in fine) → calm (banner stands down to a small
persistent badge, since the victim was never actually found). Route stays
drawn through arrival + reporting, only cleared at calm. Minor/ambient
hazards shrink to a small, label-less, dim version (`iconMinimized`) while a
FLARE is actively unfolding, back to full size at calm.

**Mostly simulated, but real underneath in two places:**
- **Routing**: `fetchRoadRoute()` gets real road-snapped geometry from OSRM
  (see Backend section for the production caveat). Falls back to
  `buildFallbackRoute()` (a bezier curve) if unreachable. Real routes can
  have very different point counts than expected, so `resamplePath()`
  resamples to a fixed step count for consistent animation timing — the
  *drawn* line is still the full, unsampled real route.
- **Comms log**: `src/store/commsLog.ts` is the real shared store (moved out
  of `CommsLogPanel.tsx`'s local state) specifically so this sequence can
  post into it — that part isn't a placeholder.

Still fake: `MESH_NODES`/`EPICENTER_OFFSET` (hardcoded offsets from the
ranger's position), the ask/answer about victim detection (comms-log text,
not real hardware detection — see the Bluetooth tier 2 section), no
Bluetooth, no backend broadcast of the FLARE itself.

**Cross-page emergency notice:** `EmergencyNotice.tsx` (mounted once in
`RadarPage.tsx`, survives navigation) shows a dismissible corner toast if a
FLARE is active and the operator isn't on the tactical map page. Tracked via
`seen`/`markSeen()` in `src/store/flare.ts`. Note: only the *notification*
persists across navigation — `FlareSequence`'s phase state lives locally in
`TacticalMapCanvas` and un-mounts (losing its place mid-sequence) if the
operator navigates away. Fine for now since the sequence is short; would
need lifting to a global store if that becomes a real problem.

Dropped the giant "GEMPA!" title card (read as over-the-top) — kept the
double shockwave ring and the modest banner text.

**Epic-effect pass (visual only):** freeze-frame beat before the
shake/flash, canvas-drawn seismograph HUD (`SeismographReadout.tsx`,
amplitude scaled by real BMKG magnitude), comet trail of fading
`CircleMarker`s behind the dispatched unit, live ops HUD (`OpsHud` —
magnitude counting up, units dispatched, ETA countdown).

**Click-to-focus markers:** every hazard/epicenter marker is clickable
(`FocusableMarkers`) — flies the camera in tight on whatever's clicked.
Deliberately manual, not automatic, since the minor hazards are always
on-screen and auto-focusing all of them would yank the camera around for no
reason. Could make sense to auto-focus by severity once a real
detection/ranking system exists — doesn't yet.

## BMKG earthquake feed — real, live data (not simulated)

`src/store/bmkg.ts` polls `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`
every 2 minutes — BMKG's public latest-quake feed, no key required, CORS
wide open (confirmed by hand). This is real data, not a placeholder.

**Important boundary, don't blur this later:** the FLARE drill borrows this
feed's real magnitude (seismograph amplitude, HUD counter, banner text) but
keeps its epicenter at a local offset from the ranger's position — the
actual BMKG quake could be anywhere in Indonesia, and using its real
coordinates for a "ranger responds locally" drill would be geographically
dishonest. If a later feature wants to react to a *specific* real quake's
actual location (e.g. only trigger FLARE within X km of the ranger), that
needs new logic — don't assume `useBmkgQuake()`'s coordinates are "near"
anything.

**Two BMKG surfaces, on purpose:** `BmkgIndicator.tsx` in the sidebar is the
always-on ambient readout (every page, every phase). `BmkgTicker.tsx` on the
map only appears once a FLARE is active — same data, different context.
Don't merge these; sidebar = "business as usual," map = "relevant right
now."
