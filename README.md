<div align="center">

# Offroute

**Offline Disaster Navigation and Evacuation Command Ecosystem**

Evacuation navigation that keeps working when the internet does not.

[![CI](https://github.com/GerasimosAlpen/Offroute/actions/workflows/ci.yml/badge.svg)](https://github.com/GerasimosAlpen/Offroute/actions/workflows/ci.yml)
[![Release](https://github.com/GerasimosAlpen/Offroute/actions/workflows/release.yml/badge.svg)](https://github.com/GerasimosAlpen/Offroute/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

GEMASTIK — Software Development · Team **Kata Abe Bebas Dah** · Binus University

[Download](https://github.com/GerasimosAlpen/Offroute/releases/tag/latest) ·
[Documentation](docs.md) ·
[Feature status](TODO.md)

</div>

---

## The problem

Indonesia sits at the meeting point of three active tectonic plates, inside the
Pacific Ring of Fire. BNPB recorded **more than 5,400 disasters in 2023**,
affecting **over 8 million people**.

What turns a disaster into a larger one is usually the delay in responding. And
that is exactly where ordinary navigation apps fail:

| Problem | What it means in the field |
|---|---|
| Cloud-based navigation dies without internet | The network is almost always down during a major disaster |
| Offline maps show **normal** road conditions | The "fastest" route can lead straight into a landslide |
| No way to spread a report without internet | One person knows a road is blocked; a hundred others do not |
| Emergency channels need cell signal | Anyone on a dying battery or out of range has no option |

The result repeats every time: people get trapped on blocked routes, some
evacuation points overflow while others sit empty, and SAR teams cannot see
where the real obstructions are.

## The solution

Offroute is a **two-sided** ecosystem — one side for the people being
evacuated, one for the people doing the evacuating — designed so its core
features work without an internet connection.

Three roles, three interfaces, one shared source of data:

| Role | Route | Who it is for | Form factor |
|---|---|---|---|
| **Citizen** (warga) | `/user` | Affected members of the public | Mobile, responsive |
| **Field personnel** | `/ranger/personel` | SAR teams and volunteers | Mobile, no install needed |
| **Ranger Command** | `/ranger/radar` | BPBD/Basarnas operators at the post | Desktop tactical console |
| **SOS** | `/sos` | Victims, no account | One-shot emergency beacon |

### What it does

- **Hazard-aware routing** — not merely the fastest route, but one that accounts
  for incoming hazard reports. Roads reported as blocked get avoided.
- **Incident reporting** — anyone can mark an obstruction on the map, and that
  report immediately changes the routes offered to everyone else.
- **FLARE mode** — declares a major incident. Every connected device receives
  the alert, the nearest units get dispatched, and the evacuation sequence runs.
- **Tactical map** — operators see unit positions, evacuation points and their
  capacity, active hazard zones, and live personnel locations.
- **Comm Center** — radio coordination between the command post and the field.
- **Evacuation points** — operator-managed, with capacity and occupancy, so
  routing never sends people somewhere already full.
- **Offline cache** — data is stored in local SQLite, and changes made while
  offline are queued and replayed once the connection returns.
- **BMKG earthquake feed** — live earthquake data straight from BMKG, not mocked.

### WPMTRS, in plain terms

*Weighted Path Multi Target Routing System* — the academic core of the
proposal. Three ideas combined:

1. **Weights, not just distance.** Every road segment carries a cost:

   ```
   cost(e) = w₁·time(e) + w₂·hazard(e) + w₃·incident(e)
   ```

   A dangerous shortcut can lose to a longer, safer detour.

2. **Many destinations at once.** The question is not "how do I get to point X"
   but **"which evacuation point makes the most sense for me right now"** —
   evaluated together, and only across points that still have capacity.

3. **Accelerated search.** *Contraction Hierarchies* (Geisberger et al., 2008)
   pre-contracts the road graph so queries resolve far faster than plain
   Dijkstra.

> **Honest status:** points 1 and 2 are reflected in how the app behaves today.
> Point 3 — the Rust CH engine and its PBF parser — is **not built**. Routing
> currently uses OSRM and still requires internet. See the table below.

---

## Status: what is real, what is not

This section is deliberately blunt. The proposal describes the target system;
this table describes the code that exists today. [`TODO.md`](TODO.md) is the
full engineering record.

### Real and working

| Component | Notes |
|---|---|
| NestJS + Prisma + PostgreSQL backend | 11 modules, 34 REST endpoints, Socket.IO gateway with 16 events |
| Realtime sync | Socket.IO, retries forever — an intermittent link is the normal condition, not an error |
| Tactical map (Leaflet) | Real map, real routing, shared by both radar and personnel |
| Incident reporting | Persisted to the database, broadcast to every client |
| Evacuation points and requests | Full flow: request, accept/reject, confirm |
| Comm Center | Persisted history, realtime messages |
| Offline cache (SQLite) | Write-through, plus a mutation queue replayed on reconnect |
| BMKG earthquake feed | Live from `data.bmkg.go.id`, **not** simulated |
| Bluetooth Tier 1 | Rust + `btleplug`, central/client role. Passes `cargo build`, **untested against real hardware** |
| Operator console | System Monitor, diagnostic terminal, embedded browser |

### Deliberately simulated

Not bugs — conscious decisions, so the flow can be demonstrated before the
hardware exists.

| What is simulated | Why |
|---|---|
| FLARE / dispatch sequence | The routing underneath is real; the mesh nodes and epicenter are fabricated |
| Victim detection via beacon | Needs Bluetooth Tier 2, which cannot be built yet |
| `MOCK_HAZARDS` on the tactical map | Waiting on real field hazard data |
| Fallback ranger roster | Waiting on the login system |
| "Which route is actually passable" | Still a distance heuristic, not real road-network awareness |

### Not built yet

| Feature | Blocker |
|---|---|
| **Offline routing (CH + PBF parser)** | The core of WPMTRS in the proposal. Needs a graph data model that does not exist. Currently uses the **public OSRM demo server**, which its own terms say is not for production |
| **UDP multicast sync** | The mesh mechanism from the proposal; no module exists |
| **Login / authentication** | No User model, no sessions, no guards. Every endpoint is still open |
| **Bluetooth Tier 2 (victim as beacon)** | Needs a GATT server role Tauri does not provide; iOS blocks background BLE advertising at the OS level |
| **Native device location** | Currently falls back to IP-based lookup |

> Offroute is a student project, **not** certified emergency equipment. Do not
> treat it as a replacement for SAR radio, BNPB satellite links, or the 112
> emergency line.

---

## Tech stack

| Layer | Technology |
|---|---|
| App shell | Tauri v2 (Rust) — desktop and Android from one codebase |
| UI | Preact 10 + TypeScript 5.6 (**not** React) |
| Bundler | Vite 6 |
| Styling | Tailwind CSS v4 |
| State | Zustand v5 |
| Data fetching | TanStack Query + Axios |
| Maps | Leaflet + react-leaflet (via `preact/compat`) |
| Router | wouter (hash-based, required for the Tauri webview) |
| Realtime | Socket.IO |
| Backend | NestJS v11 + Prisma v7 + PostgreSQL |
| Local cache | SQLite via `tauri-plugin-sql` |
| Bluetooth | `btleplug` (Rust) |
| Package manager | Deno |

## Running it

```bash
# 1. Frontend dependencies
deno install

# 2. Backend (separate terminal)
cd _server
npm ci
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, ADMIN_TOKEN
npx prisma generate
npm run start:dev

# 3. The app
deno task dev             # browser, http://localhost:1420
deno task tauri dev       # desktop app
deno task tauri android dev
```

Full detail — every environment variable, the architecture of each module,
troubleshooting, and how CI/CD works — lives in **[`docs.md`](docs.md)**.

## Downloads

Every merge to `main` publishes fresh installers for Windows, macOS, Linux and
Android to the [`latest`](https://github.com/GerasimosAlpen/Offroute/releases/tag/latest)
pre-release. Tagged versions get permanent
[releases](https://github.com/GerasimosAlpen/Offroute/releases). Per-PR builds are
also available as artifacts under
[Actions](https://github.com/GerasimosAlpen/Offroute/actions).

> The Android APK is signed with a debug key — fine for testing, not for public
> distribution. macOS and Windows will warn about an unidentified developer,
> since there is no code signing certificate yet.

## Team

| Name | Student ID | Responsibility |
|---|---|---|
| Muh. Daffa Dwi Syahreza | 2802492062 | Team lead — architecture, graph and routing engine |
| Gerasimos Alven Raditya Baskara | 2802438501 | Data parser, graph structures, backend |
| Albertus Adrian Wicaksono | 2802451876 | Front-end, synchronisation, dashboard |

Computer Science, Binus University, Jakarta.

## Contributing

See the *Contributing* section of [`docs.md`](docs.md). In short: branch off,
use [Conventional Commits](https://www.conventionalcommits.org/), make sure
`deno task typecheck` and `deno task test` pass, then open a PR.

## Licence

[MIT](LICENSE) — including an important note about emergency use.

## References

- BNPB (2023). *Data Informasi Bencana Indonesia (DIBI)*. <https://dibi.bnpb.go.id/>
- Geisberger, R. et al. (2008). *Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks*. WEA'08.
- Guan, W., Guan, S. & Zhao, J. (2023). *Dynamic Evacuation Path Planning for Multi Exit Building Fire*. Fire Technology 59(5).
- Knopp, S. et al. (2007). *Computing Many to Many Shortest Paths Using Highway Hierarchies*. ALENEX'07.
- Kurbanov, T., Cuchy, M. & Vokrinek, J. (2022). *Fast One to Many Multicriteria Shortest Path Search*. arXiv:2201.12684.
- Zhou, L. & Liang, X. (2022). *A Dynamic Risk Based Routing Approach for Multi Source and Multi Sink Evacuation*. Reliability Engineering & System Safety.
- OpenStreetMap Contributors. Indonesia regional extract. <https://download.geofabrik.de/asia/indonesia.html>
