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

## Control console: terminal, data reset, app control (2026-07-15)

Turned the System Monitor into a control center, and added a real Linux-style
diagnostic terminal.

- **Diagnostic terminal** (`/ranger/radar/terminal`, nav "Terminal"). Feels
  like a real shell: `radar@offroute:~$` prompt, blinking block cursor,
  up/down command history, Ctrl+L. Real **allowlisted read-only** OS commands
  run via Tauri (`commands/terminal.rs` — `run_system_command`): uname, df,
  vm_stat, ifconfig, ping (auto `-c 4`), ps, top, etc. Spawned directly (no
  shell → no `;`/pipe injection), 10s timeout, 40KB output cap. **Not an
  allowlist match → friendly refusal; not in Tauri → a notice, never an
  error.** Built-ins run anywhere: help, clear, status, health, queue[ flush],
  ble, reseed, report, restart, about (`src/lib/terminal.ts`).
- **Reset mock data** — new `POST /admin/reseed` (`admin` module) wipes every
  domain table in FK-safe order and restores the canonical rangers + seed
  incidents + initial comms, in one transaction, then broadcasts `data-reset`
  so every client reloads to a clean state. `GET /admin/stats` gives live row
  counts (shown in the monitor). **Verified live**: a DB with accumulated test
  junk (7 incidents, tasks, victims, pins, flare) → exactly the canonical seed
  (4 personnel, 5 incidents, everything else 0). Surfaced as a two-step
  confirm button + the `reseed --yes` terminal command.
- **App control** (`commands/control.rs`, no extra plugin — uses
  `AppHandle::restart()/exit()`): **Restart App** and Quit. Deliberately an
  *app* restart, **not an OS reboot** — rebooting the operator's machine
  mid-operation is destructive and privileged, so "reboot" is scoped to
  relaunching this process (stated in the UI). `write_report_file` writes a
  diagnostics report to ~/Downloads (browser falls back to a blob download —
  still "makes a file").
- **Multi-directional window resize** shipped earlier this session
  (`FloatingWindow`, 8 grips).

New Tauri commands need no capability entries (custom app commands aren't
plugin-gated). `tokio` gained the `process`/`time` features for the terminal.

## System Monitor + whole-op observability pass (2026-07-15)

Made radar a complete observer of every role, and gave it a self-healing
diagnostics console — verified the whole loop end-to-end against the real DB.

- **Radar watches everything.** New `src/store/systemActivity.ts` is a
  read-only observer that subscribes to all 15 domain WS events and folds
  them into one live timeline (warga reports, SOS, dispatch/report/confirm,
  evac, FLARE, backup pins, unit online/offline via presence-diff). Rendered
  by `SystemActivityFeed`.
- **Its own page, not another window.** The tactical map went back to its
  clean 4-window layout; the monitor lives at `/ranger/radar/monitor` (nav
  "Monitor Sistem"). `SystemMonitor.tsx` shows a parameter grid — API +
  latency, DB, WebSocket, connectivity, offline-queue depth, Bluetooth mesh,
  GPS, BMKG feed, online units, server address — plus **self-heal commands**
  (reconnect WS, flush offline queue, rescan BLE, refresh data, re-check) and
  the live activity feed.
- **New `GET /health`** (`app.controller.ts`, registered in `app.module`) —
  liveness + DB reachability; `healthApi.ping()` times it. Verified live:
  `{ok:true, db:true}` at ~88ms.
- **Multi-directional window resize.** `FloatingWindow` now has 8 grips
  (N/S/E/W + corners); dragging any edge/corner resizes with the opposite
  edge pinned, OS-style — not just bottom-right.
- **End-to-end verification (real Supabase DB, live server).** Drove the full
  handshake over REST: warga `POST /incidents` → personel `self-assign`
  (second unit correctly **400 blocked**) → `report done` (200) → radar
  `reject` → back to enroute → `report` again → `confirm` (201) → hazard in
  `/tasks/resolved`, live task cleared. Every step behaved as designed.

Still needs a real two-**client** UI test (WS fan-out between two browsers);
the backend + event contract are confirmed, the cross-client rendering isn't
yet exercised here.

## Task-completion handshake + Comm Center hub pass (2026-07-15) — no migration

Made the radar↔personel↔warga loop a real two-way coordination system,
centered on the Comm Center. **No schema change** — `TaskStatus` stays
`enroute|arrived`; the extra lifecycle rides on existing tables:

- **Two-step completion.** `arrived` now means "field unit reported done,
  awaiting radar confirmation" — it no longer auto-writes a ResolvedHazard.
  New `POST /tasks/:id/confirm` (writes ResolvedHazard + `task-confirmed`,
  clears the live task) and `POST /tasks/:id/reject` (`task-rejected`, unit
  back to enroute). `GET /tasks/resolved` hydrates confirmed ones separately.
  Client lifecycle: `enroute → onscene → reported → (confirmed)`. Personel
  marks done from the Bahaya page (`TaskActions` in `DangerLevel.tsx`); radar
  confirms from either Status Taktis or the Comm Center pending-cards.
- **Self-assign + double-dispatch validation.** `POST /tasks/self-assign`
  (personel takes a hazard themselves, SERIALIZABLE-validated so it can't
  race radar). Store guards every dispatch path with `hazardHasActiveUnit()`;
  Status Taktis hides "Kirim Unit" whenever a unit is already on it, and
  shows "MANDIRI" when the unit self-assigned. So radar never sends a second
  unit to a hazard a field unit already took.
- **Comm Center = the hub.** Renamed the operator sender "ANDA" → **HQ**.
  Dispatching auto-opens the unit's comms frequency and auto-draws the route
  (route was already drawn; the frequency line + per-unit filter are new).
  Pending completion reports surface as Konfirmasi/Kembalikan cards in the
  panel. Backup requests (`Minta Backup`) now drop a pulsing red map pin
  (`MessagePinMarkers`, brought back) so HQ sees *where*, plus the chat line.
- **OS-like windows.** Radar panels minimize to a `WindowTaskbar`
  (`useWindowLayout` gained `minimized` + persist) to declutter.
- **Cross-device responsive.** Tauri window now 1440×900, min 1024×640,
  resizable+centered (was a fixed 800×600). Mobile shells use `h-dvh`
  (phone browser-chrome safe) + `viewport-fit=cover`; radar padding/header
  scale down (`p-4 lg:p-10`). Radar stays desktop-gated by design; personel
  and warga are mobile-first.

Everything above builds clean (frontend tsc+vite, nest, cargo). Not yet
exercised with two live clients — the confirm/reject and self-assign races
want a real two-device smoke test.

## Cross-role integration pass (2026-07-15) — every role now works from the same live data

Follow-up to the bug-fix pass below, per an explicit "all roles work
together, offline-first, de-hardcode" request:

- **Dispatch works on live data**: `useTasksStore.assign()` now accepts an
  `AssignContext` of the live `useIncidents()`/`usePersonnel()` results,
  threaded from `HazardStatusPanel` — a newly reported incident is now
  actually dispatchable via "Kirim Unit" (previously only seed-id hazards
  were; the static arrays remain the documented fallback).
- **User role wired into the real feed**: `EmergencyReport` submits real
  `POST /incidents` (shared `HazardKind` taxonomy, GPS folded into the
  description, offline mutation-queue replay via the new `submitIncident()`
  in `useIncidents.ts` — also adopted by radar's `LaporIncident`), and its
  history tab is the live incident list with handling status derived from
  the shared task/resolution stores. `DisasterMap`'s mock markers/routes are
  gone: it renders confirmed evacuation points + live incidents, and fetches
  a real OSRM walking route (bezier fallback offline) to whichever marker is
  selected.
- **Personel wired into the real feed**: `PetaTaktis`'s and `DangerLevel`'s
  hardcoded EVENTS arrays replaced with adapters over `useIncidents()`
  (`hazardsToEventMarkers` in `peta-taktis/events.ts`); handling status
  comes from the shared tasks store. Casualty counts are shown as "—" now
  (no real data) instead of invented numbers.
- **Realtime cross-device location**: `location.ts` was already a
  continuous `watchPosition`; what was missing was *sharing*. The presence
  heartbeat now carries a validated `lat`/`lon` (sent every 20s AND on GPS
  movement, ≥3s apart), the gateway passes it through `presence-update`,
  radar renders every live unit via `LivePersonnelMarkers`, and positions
  feed the single shared `rangerLastKnownPos` through
  `reportRemoteRangerPosition()` (guarded so a locally-animated glide is
  never yanked by its own echo).
- **De-hardcoded connectivity**: backend URL resolves via
  `src/lib/apiBase.ts` (localStorage `offroute.apiUrl` override → import
  `VITE_API_URL` → localhost); server CORS origins extendable via a
  `CORS_ORIGINS` env var for LAN devices; the Socket.IO client now retries
  **forever** with backoff (it used to permanently give up after 10
  attempts — fatal in intermittent disaster networks).

Still deliberately static/simulated: `RANGERS` roster fallback,
`getSelfRanger()` random-identity stand-in (blocked on the deferred login
system), and everything inside the FLARE drill cinematic.

## Bug-fix pass (2026-07-14) — concurrency races fixed app-level; one migration left for the collaborator

A whole-codebase bug hunt fixed the backend's check-then-write races
**without touching the Prisma schema** (deliberate — no migration run
against the shared Supabase DB from this side):

- `PrismaService` now exposes `$transaction` (+ a `PrismaTx` type);
  `tasks.assign()` and `flare.activate()` run their guards + create inside
  SERIALIZABLE interactive transactions, `tasks.updateStatus()` and
  `evacuation.accept()` wrap their two-write sequences in transactions.
- `tasks.updateStatus()` gained a transition guard (only `enroute→arrived`;
  repeat PATCHes are idempotent no-ops, no re-emit).
- `flare.activate()` is idempotent while a FLARE is active (returns the
  existing alert instead of minting a duplicate-sequence second one).
- Victims: a `rescued` victim can no longer be resurrected onto radar by a
  late `report()`/`assignRanger()` (`400` instead of a `victim-sos`
  re-broadcast); `confirmRescue()` is idempotent.
- Evacuation: `reject()` (and `accept()`) now broadcast
  `evac-request-decided { id, accepted }` so other radar clients drop the
  pending card (frontend subscribes in `src/store/evacuationRequests.ts`);
  `createRequest()` dedupes to one open request per ranger.
- DTO lat/lon fields got `@Min/@Max` bounds; CORS origins unified in
  `_server/src/cors.ts` (used by both `main.ts` and the gateway).

**For the collaborator (needs a Prisma migration, not done here):** the
durable fix for the assign race is a partial unique index on
`Task(hazardId) WHERE status = 'enroute'` — the SERIALIZABLE transaction in
`tasks.service.ts` covers it app-level, but a DB constraint is the real
guarantee. See the `TODO(collaborator)` comment in `tasks.service.ts`.

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

**Backend gaps found in this pass — all three now fixed, see "Backend
completion, FLARE stand-down, SQLite cache, Bluetooth Tier 1" below:**
- ~~No `POST /comms` route~~ — fixed: `CreateCommsEntryDto` +
  `POST /comms` added, `commsLog.ts`'s `append()` now persists.
- ~~`LaporIncident.tsx` is a pure UI mock~~ — fixed: switched to the shared
  `HazardKind`/`HazardSeverity` taxonomy, wired to `POST /incidents`, history
  panel now reads from `useIncidents()`.
- ~~`EventsGateway` provided per-module~~ — fixed: consolidated into a
  shared `GatewayModule`.
- ~~Uncommitted local diff in `_server/prisma/schema.prisma` + untracked
  `_server/bun.lock`~~ — **resolved before 2026-07-14's bug-fix pass**:
  verified `git status` clean for `_server/` and `bun.lock` tracked. Note
  the repo root still tracks three lockfiles (`bun.lock`, `deno.lock`,
  `package-lock.json`) while the build runs via `deno task` — deliberately
  left alone (can't verify which package managers are in daily use), but
  worth consolidating eventually.

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

## Backend completion, FLARE stand-down, SQLite cache, Bluetooth Tier 1 — built (2026-07-14)

Four workstreams, done together per an explicit user request to "finish the
backend for real," make FLARE emergencies end-able, cache real data offline
via SQLite, and start on Bluetooth for finding "korban" (victims). Full plan
lives in the session's plan file; summary here for future reference.

**1. Backend `_server` cleanup** — the three gaps listed above, plus:
`CreateIncidentDto`-shaped submission from `LaporIncident.tsx` submits
`offsetLat: 0, offsetLon: 0` ("reported at my own position") — **not a real
fix** for the underlying issue that `Incident.offsetLat/offsetLon` are
relative-to-viewer, not absolute coordinates (confirmed via 3 render call
sites in `TacticalMapCanvas.tsx`). A real fix means migrating to absolute
lat/lon — bigger, deliberately not done here.

**2. FLARE manual stand-down** — `POST /flare/deactivate` (new,
`flare.service.ts`'s `deactivate()`, transitions `FlareStatus` to `calm`,
which existed in the schema but was never written by anything until now).
`src/store/flare.ts` gained a `deactivate()` action and a 2-minute
client-side auto-expiry backstop (keyed to `sequence`, so a stood-down or
superseded FLARE's stale timer can't misfire). New `StandDownButton.tsx` in
the radar header, next to `StatusBadges`. **Assumption, flag if wrong:** the
user's two answers ("manual button" + "2 minutes") were reconciled as manual
being primary, 2-minute timer being a soft backstop, not the main UX.

**3. Real SQLite offline cache** — `tauri-plugin-sql` was registered and
permissioned but only ever used in a demo notes card; the real app fell back
to hardcoded static arrays or silently swallowed failures. New
`src/lib/offlineCache.ts`: two generic tables (`cache_entities`,
`mutation_queue`), wired write-through/read-fallback into every `loadX()`
store (`messagePins`, `tasks`, `evacuationPoints`, `evacuationRequests`,
`commsLog`) plus `useIncidents.ts` (handled specially — it's a TanStack
Query hook, not a Zustand store, so the cache lives inside `queryFn` instead
of a `catch` block). Mutation queueing wired at the two call sites that
needed it most: `commsLog.ts`'s `commsApi.append()` and `tasks.ts`'s
`tasksApi.assign()`. The previously-dead `useOnlineStatus` hook now actually
drives `retryQueuedMutations()` in `App.tsx`'s `AppInit`.

**4. Bluetooth Tier 1 (desktop BLE relay)** — real, not simulated:
`src-tauri/src/commands/bluetooth.rs` (new Rust module, `btleplug` crate)
adds `ble_start_scan`/`ble_stop_scan`/`ble_list_devices`/`ble_connect`/
`ble_disconnect`/`ble_send_message` Tauri commands, using the Nordic UART
Service (NUS) UUID scheme so it's testable against any real NUS-compatible
peripheral (e.g. a phone in nRF Connect's peripheral mode) rather than
needing Offroute's own peripheral role to exist. **`cargo check` and
`cargo build` both pass clean** (verified this session — unlike the
abandoned native-geolocation attempt, a Rust toolchain was actually
available here) — but this has **not been tested against real Bluetooth
hardware**, since none was available in this environment. `src/store/
bluetooth.ts` + a debug `BluetoothCard.tsx` in the demo playground are the
only frontend surface so far — no real radar UI integration yet.

**Important limitation, called out explicitly per the plan:** `btleplug` is
BLE **central/client only** — it can scan and connect to existing
peripherals, but cannot host a GATT server (peripheral role) on any desktop
platform. That means **this does not yet let two Offroute instances talk to
each other** — only to a third-party peripheral. Making Offroute-to-Offroute
relay work is Phase 2 (not built): needs one side to host a GATT server,
which only has a mature crate on Linux (`bluer`); macOS/Windows would need
direct native FFI, comparable in risk to the abandoned geolocation spike.
Victim-beacon detection ("korban ditemukan") stays fully simulated per
explicit user decision — see the extended comment in `TacticalMapCanvas.tsx`
above the victim-signal-exchange log lines, which now names this section and
the iOS background-BLE restriction directly.

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

## Native device location — deferred; IP fallback shipped 2026-07-15 (fixes Tauri "no location")

**Resolved the practical blocker without native code:** radar reported it
"can't access realtime location" in `deno task tauri dev` — the classic
WKWebView symptom where the OS geolocation prompt never appears and
`watchPosition` silently yields nothing. `src/store/location.ts` now falls
back to **IP-based geolocation** (`ipwho.is`, then `ipapi.co`; both keyless,
CORS-open, added to the Tauri CSP `connect-src`) whenever the Geolocation API
is unavailable, denied, errors, OR hasn't produced a fix within 6s (webviews
can hang without firing either callback). Gives a real city-level position —
exactly right for a stationary command console — and precise GPS still takes
over automatically (`hasLiveFix` guard) if it ever succeeds. Verified the
provider returns correct coordinates for this network. `setManualLocation`
remains as the explicit override.

The native route below is still the "someday, precise, mobile" answer, but is
no longer blocking desktop radar.

Removed after causing macOS link failures and burning a lot of disk space
mid-session. Browser Geolocation (`src/store/location.ts`) is the primary
source; IP fallback (above) covers the webview gap.

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

## Bluetooth — two tiers, tier 1 built (desktop central/client only)

Both tiers sit on top of the Bluetooth research spike already flagged in
`CLAUDE.md` (no official Tauri Bluetooth plugin exists; needs a custom Rust
module, e.g. `btleplug`).

**Tier 1 — built, 2026-07-14:** `src-tauri/src/commands/bluetooth.rs`
(`btleplug` crate) + `src/store/bluetooth.ts` + a debug `BluetoothCard.tsx`
in the demo playground. Speaks Nordic UART Service (NUS) so it's verifiable
against any real NUS-compatible peripheral without needing Offroute's own
peripheral role. `cargo check`/`cargo build` both pass clean — **not tested
against real Bluetooth hardware** (none available in this environment).
**Important limitation:** `btleplug` is central/client only — it cannot host
a GATT server, so this does *not* yet let two Offroute instances talk to
each other, only to a third-party peripheral. No radar UI integration yet
beyond the demo card, and personel↔radar relay (the original README ask)
still needs Phase 2 below.

Original plan, still accurate for what's left:

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
- **Desktop-to-desktop relay also needs a peripheral role**, separate from
  the mobile-beacon problem above — `btleplug`'s central-only nature means
  two desktop Offroute instances can't talk to each other yet either. Only
  Linux has a mature Rust crate covering both central *and* peripheral
  (`bluer`, BlueZ D-Bus bindings); macOS/Windows peripheral hosting needs
  direct native FFI (CoreBluetooth, WinRT's `GattServiceProvider`) with no
  ready-made safe crate. Start here (Linux/`bluer`) if Offroute-to-Offroute
  relay becomes the actual bar for success, not just talking to a
  third-party test peripheral.

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

## Login / auth — deferred, not built yet

No auth system exists anywhere in this codebase today — no `User` model, no
session/token handling, no login UI on either radar or personel. This was
first flagged as an open question back when radar's desktop-only gate
(`DesktopOnlyGate.tsx`) was built: "detect if the app is open on desktop so
we can navigate our user to a login tab and know who it is and what role
they're in" — deliberately not scoped then given how large a decision it is.
User explicitly asked (2026-07-14) for this to be added to the backlog for
later, one login page each for **radar** and **personel** — not to be
implemented now.

**Open questions to resolve before starting:**
- Backend: needs a real `User`/`Session` model in Prisma, password hashing
  (or magic-link/OTP given the disaster-response context — a memorized
  password may not be realistic for a field ranger mid-emergency), and
  session/token issuance + validation middleware across every existing REST
  endpoint (currently all wide open, no auth guard anywhere).
- Role assignment: how does a login map to RADAR vs PERSONEL? A single
  `role` field on `User`, or something more granular per-ranger (tying into
  the existing `Personnel` model / `RANGERS` roster)?
- Radar vs personel login UX likely differ a lot — radar is a stationary
  desktop console (one-time login per shift is probably fine), personel is
  the no-install-friendly mobile side (the new `/sos` page proves a
  no-account flow is possible and valuable — don't accidentally force every
  personel interaction behind a login if that undermines that).
- Interacts with the still-open desktop-detection idea from `CLAUDE.md`
  (redirect a desktop browser hitting personel's routes to a login/role
  picker) — worth deciding together rather than as two separate features.
