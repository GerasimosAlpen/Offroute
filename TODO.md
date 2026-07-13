# TODO

## Native device location (deferred)

Removed for now — was causing macOS link failures and the research burned a lot
of disk space mid-session. Browser Geolocation (`src/store/location.ts`) is
back to being the only location source, same as before this was attempted.

**Why native was wanted:** Tauri's webview Geolocation API is unreliable
across platforms, so the plan was a real Tauri command
(`get_device_location`) backed by the actual OS location service per
platform, mirroring how `get_battery_status` / `get_network_status` already
work in `src-tauri/src/commands/system_status.rs`.

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

## Tactical Map — wire real backend data

`TacticalMapCanvas.tsx` now renders a real Leaflet map (`react-leaflet`,
CARTO dark basemap) centered on the ranger's actual GPS position, but the
markers on it are still mock data:

- **Other rangers' positions** — no markers for other personel yet at all.
  Once the realtime location endpoint exists (README phase 3 — NestJS
  WebSocket gateway; `socket.io-client` is already installed on the
  frontend), add a `<Marker>` per personel, updated as their location events
  arrive. See the `TODO(backend)` comment above `SELF_ICON` in
  `TacticalMapCanvas.tsx` for where this plugs in.
- **Incident/report locations** — `MOCK_HAZARDS` in the same file is three
  hardcoded incidents offset from the ranger's own position, just so
  something renders. Once the Lapor Incident report endpoint exists
  (README phase 2/3 — NestJS `ranger` module + Report/Incident model),
  replace `MOCK_HAZARDS` with real incident coordinates fetched from there.

## FLARE / dispatch sequence — fully simulated

The sidebar "Mode Flare" button (`FlareButton.tsx` → `src/store/flare.ts`)
drives a whole scripted sequence in `FlareSequence` (inside
`TacticalMapCanvas.tsx`), phase by phase: detect (shake + flash + flyTo
epicenter) → scan (zoom out, reveal mesh nodes) → dispatch (pick nearest
team, draw a route) → en route (animate the team along the route, spawn a
second "victim" partway through, log a proximity update near the end) →
arrived (tight push-in) → reporting (everyone else checks in fine, logged to
Comm Center) → calm (banner stands down to a small persistent badge, since
the second victim was never actually found).

**Mostly simulated, but the route itself is now real** — no earthquake
detection, no FLARE broadcast to a backend, no Bluetooth. Specifically:

- `MESH_NODES`, `EPICENTER_OFFSET` — hardcoded offsets from the ranger's own
  position, same as before.
- **Routing is real now**: `fetchRoadRoute()` calls
  `router.project-osrm.org` (OSRM's public **demo** server — free, no key,
  actual road-snapped routes, but rate-limited and explicitly "not suitable
  for production" per OSRM's own policy). Falls back to
  `buildFallbackRoute()` (a bezier curve) if OSRM is unreachable. Before
  shipping: self-host OSRM or move to a paid routing API. This is also still
  fully online-only — the README's own routing phase (Dijkstra over a local
  node graph, for the offline case) is a separate, not-yet-scoped effort;
  this doesn't cover offline routing.
- The Bluetooth relay itself is already flagged in `CLAUDE.md` as its own
  research spike (no official Tauri Bluetooth plugin exists; would need a
  custom Rust module, e.g. `btleplug`) — this UI is what it should animate
  into once that exists, not a replacement for building it.
- `src/store/commsLog.ts` is now the shared comms-log store (moved out of
  `CommsLogPanel.tsx`'s local state) specifically so the FLARE sequence can
  post dispatch/status updates into it — that part's a real, reusable piece,
  not a placeholder.

**Cross-page emergency notice:** `EmergencyNotice.tsx` (mounted once in
`RadarPage.tsx`, so it survives navigation) shows a dismissible corner toast
if a FLARE is active and the operator isn't on the tactical map page.
Tracked via `seen`/`markSeen()` in `src/store/flare.ts` — visiting the map
page marks it seen, so does clicking "Abaikan." Note: only the *notification*
persists across navigation, not the drill itself — `FlareSequence`'s phase
state lives locally in `TacticalMapCanvas` and un-mounts (losing its place
mid-sequence) if the operator navigates away and the component is torn down.
Acceptable for now since the sequence is short; would need lifting to a
global store if that becomes a real problem.

**Dropped the giant "GEMPA!" title card** — read as over-the-top rather than
epic. Kept the double shockwave ring and the (already fairly modest) banner
text; removed `ImpactTitle` entirely rather than leaving dead code around.

**Epic-effect pass (visual only, doesn't change any of the above):**
freeze-frame beat before the shake/flash, a canvas-drawn seismograph HUD
(`SeismographReadout.tsx`) with amplitude scaled by real magnitude, a comet
trail of fading `CircleMarker`s behind the dispatched unit, and a live ops
HUD (`OpsHud` — magnitude counting up, units dispatched, ETA countdown).

## BMKG earthquake feed — real, live data (not simulated)

`src/store/bmkg.ts` polls `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`
every 2 minutes — BMKG's (Indonesia's geophysics agency) public latest-quake
feed, no key required, CORS wide open (`access-control-allow-origin: *`,
confirmed by hand). `BmkgTicker.tsx` shows it as an honest, independent
live badge (magnitude/depth/region/time) — this is real, not a placeholder.

**Important boundary, don't blur this later:** the FLARE drill borrows this
feed's real magnitude number (for the seismograph amplitude, the HUD counter,
the banner text) but keeps its epicenter at a local offset from the ranger's
position. The actual BMKG quake could be anywhere in Indonesia — using its
real coordinates for a "ranger responds locally" drill would be geographically
dishonest. If a later feature wants to react to a *specific* real quake's
actual location (e.g. only trigger FLARE when a real quake lands within X km
of the ranger), that needs new logic — don't assume `useBmkgQuake()`'s
coordinates are "near" anything.

**Weather — deferred, not started.** BMKG also has a public forecast API
(`api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<code>`), confirmed reachable,
but it needs an `adm4` (kelurahan-level) area code — there's no
coordinate-to-adm4 lookup in this app, and Indonesia has thousands of these
codes. Don't hardcode one region (e.g. always showing Jakarta's weather
regardless of the ranger's real position) — that's the same
geographic-dishonesty problem as above, just for weather instead of quakes.
Needs a real adm4 lookup dataset/service before this is worth building.

**Two BMKG surfaces now, on purpose:** `BmkgIndicator.tsx` in the sidebar is
the always-on ambient readout (visible on every page, every phase).
`BmkgTicker.tsx` on the map only appears once a FLARE is active — same data,
different context. Don't merge these into one component; the sidebar one is
"business as usual," the map one is "this is relevant to what's happening
right now."

**Click-to-focus markers:** every hazard/epicenter marker on the tactical map
is now clickable (`FocusableMarkers` in `TacticalMapCanvas.tsx`) — flies the
camera in tight on whatever the operator clicks. Deliberately manual, not
automatic: these markers are always on-screen (the minor hazards especially),
so auto-focusing on all of them constantly would just yank the camera around
for no reason. If a real detection/severity ranking exists later, an
auto-focus-on-highest-severity behavior could make sense — it doesn't yet.

## Personel hardware-safety mode — not started, blocked on the platform decision

Requested: when a personel is in danger, engage the phone's hardware
(flashlight, vibration, alarm sound, SOS/location beacon, whatever's
available) to help find/protect them — on top of just showing their position
on the radar's map.

This is entirely personel-side (phone) work, and per `CLAUDE.md`'s existing
roadmap note, **personel UI hasn't started at all** — it's blocked on
deciding whether "phone version" means a separate mobile target or a web
view, since this repo is a Tauri *desktop* app. Nothing to build on the radar
side for this; don't fake hardware-control UI on the desktop map, since the
desktop has none of the phone's hardware to control. Revisit once the
personel platform decision is made.
