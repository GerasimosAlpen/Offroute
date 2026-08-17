# Offroute — Developer Documentation

Everything you need to run, understand, and extend Offroute.

For *what* Offroute is and why it exists, read [`README.md`](README.md) first.
For the current built/simulated/deferred status of every feature, the
maintained source of truth is [`TODO.md`](TODO.md).

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Getting started](#2-getting-started)
3. [Environment variables](#3-environment-variables)
4. [Project layout](#4-project-layout)
5. [Frontend architecture](#5-frontend-architecture)
6. [Rust / Tauri layer](#6-rust--tauri-layer)
7. [Backend architecture](#7-backend-architecture)
8. [Offline behaviour](#8-offline-behaviour)
9. [CI/CD](#9-cicd)
10. [Contributing](#10-contributing)
11. [Troubleshooting](#11-troubleshooting)
12. [Known issues and cleanup notes](#12-known-issues-and-cleanup-notes)

---

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| [Deno](https://deno.com) | 2.x | Frontend package manager and task runner |
| [Rust](https://rustup.rs) | stable | Tauri desktop and mobile builds |
| [Node.js](https://nodejs.org) | 20+ | The `_server` backend only |
| PostgreSQL | 14+ | Backend database (the team uses hosted Supabase) |

**This project uses Deno, not npm or bun.** `package.json` still exists — Deno
reads it for the npm dependency set — but `deno.lock` is the only lockfile, and
`deno.json` holds the task table. Do not run `npm install` at the repo root; it
will create a competing `package-lock.json`.

`_server/` is the exception. It is a standalone Node/NestJS service with its own
`package-lock.json` and its own eslint/prettier toolchain, and it is outside
Deno's scope entirely.

### Platform-specific

**Linux** (for Tauri):

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev libssl-dev libxdo-dev patchelf build-essential
```

**macOS:** Xcode Command Line Tools (`xcode-select --install`).

**Windows:** Microsoft C++ Build Tools + WebView2 (preinstalled on Windows 11).

**Android:** Android Studio, SDK 24+, and an NDK. Tauri finds the NDK through
`NDK_HOME`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
```

---

## 2. Getting started

### Frontend

```bash
deno install          # install dependencies
deno task dev         # Vite dev server on http://localhost:1420
```

The router is **hash-based** (`wouter/use-hash-location`), because a Tauri
webview serves from `file://` where path routing does not work. In the browser
you therefore visit `http://localhost:1420/#/ranger/radar`. `App.tsx` has a
redirect shim so a plain `/ranger/radar` is rewritten to the hash form.

### Backend

```bash
cd _server
npm ci
cp .env.example .env          # then fill it in — see section 3
npx prisma generate           # REQUIRED: nothing compiles without the client
npx prisma migrate deploy     # apply migrations
npm run start:dev             # http://localhost:3000
```

Swagger UI is served at <http://localhost:3000/api/docs>.

Optional seed data (4 rangers, sample incidents, evacuation points):

```bash
npx prisma db seed
```

### Desktop and mobile

```bash
deno task tauri dev             # desktop, with hot reload
deno task tauri build           # production bundle
deno task tauri android dev     # device or emulator
deno task tauri android build --apk
```

### All tasks

| Task | What it does |
|---|---|
| `deno task dev` | Vite dev server |
| `deno task build` | `tsc && vite build` → `dist/` |
| `deno task preview` | Serve the built bundle |
| `deno task typecheck` | `tsc --noEmit` — the main quality gate |
| `deno task test` | Vitest, single run |
| `deno task test:watch` | Vitest, watch mode |
| `deno task lint` / `fmt` / `fmt:check` | Deno lint and formatter |
| `deno task tauri <cmd>` | Tauri CLI passthrough |

---

## 3. Environment variables

### Backend (`_server/.env`)

Copy `_server/.env.example` and fill it in.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Runtime connection. Supabase: the **pooler** on port 6543. |
| `DIRECT_URL` | **yes** | Migrations and seeding. Must be a **direct** connection on 5432 — pgbouncer's transaction mode cannot run migration DDL. |
| `ADMIN_TOKEN` | **yes** for admin | Shared secret guarding `POST /admin/reseed`. Unset means that endpoint returns 503. Generate with `openssl rand -hex 32`. |
| `PORT` | no | API port, default `3000`. |
| `CORS_ORIGINS` | no | Extra allowed origins, comma-separated. Needed for LAN deployment. |
| `NODE_ENV` | no | Set to `production` when deploying. |

### Frontend

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL, baked in at build time. Defaults to `http://localhost:3000`. |

### Runtime overrides (localStorage)

Set from devtools, no rebuild required — this is how a field device gets
pointed at a command post without recompiling:

| Key | Purpose |
|---|---|
| `offroute.apiUrl` | Backend base URL. Highest priority — beats `VITE_API_URL`. |
| `offroute.adminToken` | Operator's admin secret, must equal the server's `ADMIN_TOKEN`. |

```js
localStorage.setItem("offroute.apiUrl", "http://192.168.1.10:3000");
localStorage.setItem("offroute.adminToken", "<ADMIN_TOKEN>");
```

Resolution order lives in one place, `src/lib/apiBase.ts`:
`localStorage` → `VITE_API_URL` → `http://localhost:3000`.

### LAN deployment

To run a command post on a local network:

1. Start the backend on the command-post machine.
2. Set `CORS_ORIGINS` to include each field device's origin.
3. On each field device, set `offroute.apiUrl` to the command post's LAN IP.

> The Tauri CSP permits `http:`/`https:`/`ws:`/`wss:` in `connect-src` precisely
> so this works. CSP has no syntax for IP ranges, so a private-range-only
> allowlist cannot be expressed. `script-src` remains `'self'`.

---

## 4. Project layout

```
/
├── src/                 Preact frontend (157 files)
│   ├── main.tsx         Entry — render + QueryClientProvider
│   ├── App.tsx          Router, plus AppInit store hydration
│   ├── lib/             Shared infrastructure (api, socket, cache, routing…)
│   ├── store/           Zustand stores, one per domain
│   ├── hooks/           TanStack Query hooks
│   ├── user/            WARGA persona
│   ├── ranger/
│   │   ├── radar/       RANGER COMMAND (desktop operator console)
│   │   ├── personel/    FIELD PERSONNEL (mobile)
│   │   ├── sos/         Anonymous victim beacon
│   │   └── comms/       Shared comms components
│   ├── components/demo/ Tech-stack playground (route /demo)
│   └── __tests__/       Vitest suites
├── src-tauri/           Rust / Tauri v2
│   ├── src/lib.rs       Plugin registration + invoke_handler
│   ├── src/commands/    IPC command modules
│   ├── capabilities/    ACL permission allowlist
│   └── gen/android/     Generated Android project (committed)
├── _server/             NestJS backend
│   ├── src/             11 feature modules
│   └── prisma/          Schema, migrations, seed
└── .github/workflows/   CI/CD
```

---

## 5. Frontend architecture

### Routes

| Route | Component | Persona |
|---|---|---|
| `/` | `UserPage` | Warga (default) |
| `/user/:tab?` | `UserPage` | Warga |
| `/ranger/personel/:tab?` | `PersonelPage` | Field personnel |
| `/ranger/radar/:tab?` | `RadarPage` | Operator (desktop-gated) |
| `/sos` | `SosPage` | Anonymous victim |
| `/demo` | `DemoPlayground` | Developer playground |

Sub-tabs: warga has `report` / `map` / `flare`; personel has `peta` / `bahaya` /
`log` / `komunikasi`; radar has `map` / `logs` / `incident` / `comm` / `status` /
`monitor` / `terminal` / `settings`.

Radar is wrapped in `DesktopOnlyGate` — it is a stationary console and its
layout assumes a large screen. Personel and warga are mobile-first and
responsive; they are deliberately **not** styled to look like a phone mockup.

### State: which tool for what

Three systems coexist on purpose:

| Tool | Used for | Examples |
|---|---|---|
| **Zustand** (`src/store/`) | Live operational state, especially anything a WebSocket pushes | `tasks`, `flare`, `victims`, `presence` |
| **TanStack Query** (`src/hooks/`) | Server data with request caching | `useIncidents`, `usePersonnel` |
| **Local component state** | Pure UI | Panel open/closed |

The rule: if the backend can push it over the socket, it belongs in a Zustand
store, because a query cache has no natural way to receive a server push.

### Key modules in `src/lib/`

| File | Responsibility |
|---|---|
| `api.ts` | Axios instance plus every typed API namespace |
| `apiBase.ts` | The single backend-URL resolver |
| `socket.ts` | Socket.IO singleton. Retries **forever** with backoff — giving up is fatal on an intermittent disaster network |
| `offlineCache.ts` | SQLite cache and the offline mutation queue |
| `routing.ts` | Route fetching, geo maths, animation helpers |
| `persist.ts` | Tauri store ↔ localStorage abstraction |
| `tauri.ts` | `isTauri` — behaviour differs between webview and browser |
| `terminal.ts` | Radar terminal command interpreter |
| `format.ts` | Shared coordinate/age/distance formatting |

### Preact, not React

The app is Preact, but 17 files import `react-leaflet` and 33 import
`framer-motion`. They work because `react` and `react-dom` are aliased to
`preact/compat` in **three** places that must stay in sync:

- `vite.config.ts` → `resolve.alias`
- `tsconfig.json` → `compilerOptions.paths`
- `vitest.config.ts` → `resolve.alias`

`src/__tests__/pages.smoke.test.ts` exists to guard exactly this. Breaking the
aliasing fails at module-import time, and that test catches it.

Use `lucide-preact` for icons, never `lucide-react`.

---

## 6. Rust / Tauri layer

### IPC commands

All 18 registered in `src-tauri/src/lib.rs`, called from the frontend via
`invoke()`.

| Module | Commands | Purpose |
|---|---|---|
| `bluetooth.rs` | `ble_start_scan`, `ble_stop_scan`, `ble_list_devices`, `ble_connect`, `ble_disconnect`, `ble_send_message` | Tier 1 BLE relay via `btleplug`, central/client role, Nordic UART Service |
| `system_status.rs` | `get_battery_status`, `get_network_status` | Battery and WiFi, per-OS implementations |
| `control.rs` | `restart_app`, `quit_app`, `write_report_file`, `browser_navigate`, `browser_bounds`, `browser_hide`, `browser_close` | App control and the embedded child webview |
| `terminal.rs` | `run_system_command` | Allowlisted read-only diagnostics |
| `device.rs` | `emit_test_event` | Event-pipe smoke test |
| `lib.rs` | `greet` | Scaffolding, demo playground only |

`run_system_command` is worth understanding before extending: it runs a
**38-entry allowlist** of read-only binaries, spawned directly with no shell (so
there is no `;`/`&&`/pipe injection), with a 10 s timeout and a 40 KB output
cap. Keep those properties if you add to it.

### Events (Rust → frontend)

`device://status`, `ble://message-received`, `ble://device-discovered`.

### Capabilities

Tauri v2 allowlists every plugin permission in
`src-tauri/capabilities/default.json`. Adding a plugin means three coordinated
edits — `Cargo.toml`, `lib.rs` registration, and the capability file — or it
fails at runtime rather than compile time.

The capability is scoped `"windows": ["main"]`, so the embedded `radar-browser`
child webview gets **no** IPC access. That is deliberate; keep it.

Custom `#[tauri::command]`s registered through `invoke_handler` need no
capability entry.

### Release profile

`Cargo.toml` sets `opt-level = 3`, `lto = true`, `codegen-units = 1`,
`panic = "abort"`, `strip = true`. Note that `panic = "abort"` means a panic
inside a command aborts the process instead of returning an IPC error — every
command returns `Result` for this reason. Keep that up.

---

## 7. Backend architecture

NestJS v11 + Prisma v7 + PostgreSQL. 11 feature modules, 34 REST endpoints, a
Socket.IO gateway.

### REST endpoints

| Base | Endpoints |
|---|---|
| `/` | `GET /`, `GET /health` (liveness + DB reachability) |
| `/personnel` | `GET /`, `GET /:id` |
| `/incidents` | `GET /`, `POST /` |
| `/tasks` | `GET /`, `GET /resolved`, `POST /assign`, `POST /self-assign`, `PATCH /:id/status`, `POST /:id/confirm`, `POST /:id/reject`, `POST /:id/position` |
| `/flare` | `GET /current`, `POST /activate`, `POST /deactivate` |
| `/evacuation` | `GET /points`, `GET /pending`, `POST /request`, `POST /accept/:id`, `POST /reject/:id`, `DELETE /points/:id` |
| `/messages` | `GET /pins`, `POST /pin` |
| `/comms` | `GET /history`, `POST /` |
| `/victims` | `POST /sos`, `GET /active`, `POST /:id/assign`, `POST /:id/report`, `POST /:id/reject-report`, `POST /:id/confirm` |
| `/admin` | `GET /stats`, `POST /reseed` **(destructive, token-guarded)** |
| `/proxy` | `GET /`, `GET /search` |

### WebSocket events

Server → client (16):

`task-update`, `task-confirmed`, `task-rejected`, `ranger-position`,
`flare-broadcast`, `evac-request`, `evac-request-decided`, `evac-confirmed`,
`evac-removed`, `message-pin`, `comms-message`, `incident-new`,
`presence-update`, `victim-sos`, `victim-rescued`, `data-reset`.

Client → server (1): `presence-heartbeat` — personel pings periodically and on
GPS movement. Held in memory only, never persisted, so radar can distinguish
"online right now" from "last seen".

`GatewayModule` is imported by the eight feature modules that emit, rather than
registered globally, so they share one `EventsGateway` instance.

### Data model

11 Prisma models — `Personnel`, `Incident`, `Task`, `ResolvedHazard`,
`MessagePin`, `CommsEntry`, `EvacuationPoint`, `EvacuationRequest`,
`FlareAlert`, `FlareDispatch`, `Victim` — and 5 enums: `VictimStatus`,
`HazardKind`, `HazardSeverity`, `TaskStatus`, `FlareStatus`.

The client is generated to `_server/generated/prisma`, which is gitignored.
**Run `npx prisma generate` after every clone and every schema change.**

### Security posture — read this

The backend has **no authentication layer**. All endpoints except
`POST /admin/reseed` are open to anyone who can reach the server. Auth is a
known, deliberate gap (see `TODO.md` → "Login / auth — deferred"), not an
oversight. Consequences to respect until it lands:

- Do not expose this server to the public internet. LAN or localhost only.
- `POST /admin/reseed` deletes every row in every table. It requires the
  `x-admin-token` header and fails closed when `ADMIN_TOKEN` is unset.
- `GET /proxy` fetches arbitrary URLs server-side. It resolves each hostname and
  rejects private addresses (IPv4 and IPv6, including `::ffff:` mapped forms,
  CGNAT and link-local), and follows redirects manually, re-checking each hop.
  If you touch that code, keep both properties — string matching alone is
  bypassable by DNS rebinding.

---

## 8. Offline behaviour

Offline-first is the reason this project exists, so it is worth being precise
about what that currently means.

**Works offline today:** map rendering from cached tiles, previously loaded
incidents/tasks/evac points (SQLite cache), reporting an incident (queued and
replayed on reconnect), UI navigation.

**Still needs a network:** route calculation (OSRM), initial map tiles,
realtime sync, BMKG feed, reverse geocoding.

`src/lib/offlineCache.ts` implements write-through caching into two SQLite
tables, `cache_entities` and `mutation_queue`. Reads fall back to the cache when
a request fails; mutations made offline are queued and replayed by
`retryQueuedMutations()` when connectivity returns. It is a no-op outside Tauri,
because the browser build has no SQLite plugin.

The honest gap: **routing is online-only**. The offline Dijkstra/CH engine the
proposal describes is not built, and today's routing calls the public OSRM demo
server. Closing that is the single highest-value piece of work remaining.

---

## 9. CI/CD

Eight workflows in `.github/workflows/`. All validated with `actionlint`.

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push/PR | Typecheck, lint, format, tests, frontend bundle, cargo fmt/clippy/check, `_server` build + test |
| `build.yml` | push/PR/tag | Linux, Windows, macOS (ARM + Intel), Android, iOS simulator |
| `release.yml` | tag `v*` | Reuses `build.yml`, publishes a GitHub Release with all installers |
| `pr-bot.yml` | PR / build done | Sticky PR comment with a per-job status table |
| `security.yml` | push/PR/weekly | CodeQL, `cargo audit`, `npm audit`, gitleaks |
| `labeler.yml` | PR | Area and size labels |
| `commitlint.yml` | PR | Conventional Commits check — **advisory, never blocks** |
| `sprint-report.yml` | weekly | Posts a sprint summary issue |

### Notes that matter

- `ci.yml` uses path filters, so a docs-only PR skips the heavy jobs.
- Branch protection should require the single **`CI OK`** job rather than each
  matrix leg by name.
- macOS and iOS jobs are `continue-on-error: true`. They had never been built
  in this repo before, so they must not block merges until observed green.
  Remove the flag once they are.
- Android APKs are signed with the **debug key** — testable, not distributable.
  Shipping to Play Store needs a real keystore in repo secrets.
- iOS is simulator-only and unsigned. Device builds need a paid Apple Developer
  account and certificates.
- `pr-bot.yml` and `labeler.yml` use `pull_request_target` / `workflow_run`
  because PRs come from forks, where a `pull_request` token is read-only and
  cannot comment. Neither job checks out or executes PR code, which is what
  keeps that safe.

### Cutting a release

```bash
git tag v0.2.0
git push origin v0.2.0
```

---

## 10. Contributing

### Branches

`feat/…`, `fix/…`, `ci/…`, `docs/…`, `refactor/…`, `chore/…`

### Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(radar): tambah filter urgensi di Squad Logs
fix(personel): perbaiki heading marker saat GPS hilang
ci: cache Rust build biar Android tidak 15 menit
```

Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci`
`chore` `revert`. Checked by `commitlint.yml`, which warns and never blocks.

### Before opening a PR

```bash
deno task typecheck
deno task test
deno task build
cd _server && npm run build && npm test
```

### Review routing

`.github/CODEOWNERS` auto-requests reviewers by area, following the proposal's
division of labour: Daffa on architecture and routing, Gerasimos on parser,
graph and backend, Adrian on frontend, sync and dashboard.

### Real vs simulated data

The PR template asks whether your change introduces simulated data. Please
answer it honestly and record it in `TODO.md`. Several features are
intentionally simulated, and the project's credibility depends on that boundary
staying visible rather than blurring over time.

---

## 11. Troubleshooting

### macOS on an exFAT drive — read this first

This repo is often checked out on an exFAT external SSD, where macOS writes an
AppleDouble `._<name>` sidecar next to every file. This is not cosmetic:

- Sidecars inside `.git/objects/pack/` make git print
  `error: non-monotonic index` on **every** command.
- Tauri's `build.rs` tries to parse `._default.toml` as TOML and panics with
  `stream did not contain valid UTF-8`.
- esbuild, jest and vitest choke on them if they get globbed as source files.

Mitigations, all already in place: `._*` is gitignored; vitest and jest exclude
them. To clean up and prevent recurrence:

```bash
export COPYFILE_DISABLE=1
find . -path ./node_modules -prune -o -name '._*' -delete
```

**Rust cannot build with its target directory on exFAT.** Point `CARGO_TARGET_DIR`
at an APFS filesystem. If the internal disk is short on space, an APFS sparse
image on the external drive works well:

```bash
hdiutil create -type SPARSE -fs APFS -size 60g -volname OffrouteBuild \
  "/Volumes/T7 Shield/.offroute-build"
hdiutil attach "/Volumes/T7 Shield/.offroute-build.sparseimage" \
  -mountpoint /tmp/offroute-build -nobrowse
export CARGO_TARGET_DIR=/tmp/offroute-build/target
```

### Common problems

| Symptom | Cause and fix |
|---|---|
| `Cannot find module '.../generated/prisma'` | Run `npx prisma generate` in `_server/`. |
| Frontend loads, no data, no errors | Backend not running, or `offroute.apiUrl` points somewhere unreachable. Check `GET /health`. |
| Works in browser, not in the packaged app | Almost always CSP or a `isTauri` branch. Check the webview devtools console. |
| Works in Android debug, not release | Cleartext HTTP. Fixed in `gen/android/app/build.gradle.kts`; if you regenerate the Android project, reapply it. |
| Bluetooth silently does nothing on Android | Permissions are declared now, but `btleplug` also needs a JNI init call that does not exist yet. Android BLE is **not** functional — desktop only. |
| `deno task tauri build` fails on macOS | See the exFAT/`CARGO_TARGET_DIR` note above. |
| CI Android job fails on the NDK | `NDK_HOME` must be set; `build.yml` does this, local shells must too. |
| `error: non-monotonic index` | AppleDouble files in `.git/`. See above. |

### Reset the database

```bash
cd _server
npx prisma migrate reset      # local
# or, against a running server:
curl -X POST http://localhost:3000/admin/reseed -H "x-admin-token: $ADMIN_TOKEN"
```

Reseeding broadcasts `data-reset`, and every connected client reloads.

---

## 12. Known issues and cleanup notes

A conservative cleanup pass removed only provably-dead files: 26,867 macOS
AppleDouble sidecars (43 of them corrupting `.git`), the Next.js leftovers
(`.next/`, `next-env.d.ts` — no `next` dependency existed and `tsconfig`'s
`include` never compiled it), and the redundant `package-lock.json` /
`bun.lock` / `_server/bun.lock`.

The following were found unused but **deliberately left in place** for the team
to decide on. None of it is load-bearing.

### Demo scaffolding — 19 files

`src/pages/DemoPlayground.tsx`, `src/components/demo/**`, `src/store/demo.ts`,
`src/lib/useTauriEvent.ts`, plus the `greet` and `emit_test_event` Tauri
commands that exist only to serve it.

It is a working tech-stack playground reachable at `/demo`, and it is genuinely
useful for verifying that a plugin works. Note that
`src/components/demo/QueryCard.tsx:10` hardcodes `http://localhost:3000/`,
bypassing `apiBase.ts` — if you keep the playground, fix that.

### Zero-importer files

- `src/lib/utils.ts` — the shadcn `cn()` helper; the only consumer of `clsx` and `tailwind-merge`
- `src/ranger/radar/components/Panel.tsx` — superseded by `RadarPageShell`
- `src/user/components/LoadingSkeleton.tsx`
- `src/ranger/personel/pages/DaftarLaporan.tsx` — 185 lines, an older duplicate of `LogLaporan.tsx`
- `src/assets/preact.svg`, `public/vite.svg`

### Unused dependencies

`lucide-react`, `radix-ui`, `class-variance-authority`, `shadcn` (a CLI sitting
in `dependencies` rather than `devDependencies`), `@tauri-apps/plugin-opener`
and `@tauri-apps/plugin-os` (both registered in Rust and permissioned, never
imported by the frontend).

`components.json` configures shadcn against `src/components/ui/`, **which does
not exist**, and roughly 170 of the 188 lines of `src/App.css` are unused
shadcn design tokens while every component hardcodes hex colours.

### Other known issues

- **Routing uses the OSRM public demo server** (`router.project-osrm.org`),
  whose own usage policy says it is not suitable for production. Self-host OSRM
  or move to a paid API before shipping.
- **`Incident.offsetLat` / `offsetLon` are relative to the viewer, not absolute
  coordinates.** `LaporIncident.tsx` submits zeros. The real fix is migrating to
  absolute lat/lon.
- Three stub pages are live in radar's nav: `SquadLogs`, `CommCenter`,
  `SectorStatus` all render a `Placeholder`.
- `src/store/systemActivity.ts` handles 11 WebSocket payloads as `any`, while
  `src/store/tasks.ts` validates the same events properly.
- Seed fixtures are duplicated across four files: `prisma/seed.ts`,
  `admin.service.ts`, `src/lib/rangers.ts`, `src/lib/hazards.ts`.
- `Cargo.toml` still uses the scaffold lib name `tauri_app_lib`. Renaming it
  requires regenerating the Android project, which references the crate name.
- Duplicated frontend logic worth consolidating: three Leaflet icon factories,
  two `MapControls`, two map-follow hooks, three page shells, two bottom navs.
