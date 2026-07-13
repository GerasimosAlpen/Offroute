@AGENTS.md

---

# Active Roadmap: Ranger Feature

## Status

`src/ranger/README.md` is a spec only — zero implementation as of this writing. No router, no ranger routes/components, no realtime layer, no data model. Root `README.md` has no mention of ranger at all — it's just the tech-stack table.

Build order: **ranger page first (radar role → personel role), user page after.**

## Ranger Spec Recap

Desktop-only page (per `src/ranger/README.md`), two roles:

- **radar** — desktop only. Watches reports/conditions, dispatches personel, marks incidents (flood, tsunami, earthquake), sends FLARE for major incidents, gives evacuation routes, communicates with personel.
- **personel** — phone version. Patrols, reacts fast, communicates status to radar, requests tools/evac route, takes control if none given.

Requirements: realtime data stream, hardware status control, offline mode w/ Bluetooth fallback if radar location is unreachable, best-route finding, lightweight/easy to use.

**Open question:** `personel` is spec'd as "phone version" but this repo is a Tauri **desktop** app. Needs a platform decision (separate mobile target vs. web view) before personel UI work starts — do not assume until confirmed.

## Phase Plan

1. **Routing** — `wouter` installed (lightweight, matches perf goals — no react-router). Add `/ranger/radar`, `/ranger/personel` routes. Enforce desktop-only via `@tauri-apps/plugin-os` (installed) — gate ranger routes off on mobile/small viewport.
2. **Data model** (Prisma, currently empty in `_server/prisma/schema.prisma`) — `User` (role: RADAR | PERSONEL), `Node` (location), `Report`/`Incident`, `FlareAlert`, `EvacuationRoute`.
3. **Backend realtime** — NestJS `ranger` module: REST controller + WebSocket gateway. `socket.io-client` installed on frontend for this.
4. **Radar UI** — Leaflet map (already wired in `App.tsx` demo — `MapCard`), incident markers, dispatch action, FLARE trigger, comms panel, evac-route panel.
5. **Personel UI** — blocked on the platform decision above.
6. **Best-route algo** — deferred. Options: Dijkstra over the node graph (Rust, `petgraph`) for offline capability, or external routing service (OSRM/GraphHopper) if online-only is acceptable. Decide once offline requirement is scoped.
7. **Offline/Bluetooth failover** — deferred, flagged as a research spike. No official Tauri Bluetooth plugin exists; would need a custom Rust module (e.g. `btleplug`). Do not start building against this until scoped separately.

## Dependencies Added So Far

Frontend (`package.json`, installed via `deno add`):
- `wouter` — router for ranger/user page navigation
- `socket.io-client` — realtime stream client for radar↔personel communication
- `@tauri-apps/plugin-os` — JS binding for platform/OS detection

Rust (`src-tauri/Cargo.toml`):
- `tauri-plugin-os` — registered in `lib.rs`, permission `os:default` added to `src-tauri/capabilities/default.json`. Used to enforce desktop-only rendering of the ranger page and read platform info.

Not yet added (deferred until their phase): NestJS WebSocket gateway deps (`@nestjs/websockets`, `socket.io`), `petgraph` (routing algo), any Bluetooth crate.
