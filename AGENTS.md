<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **offroute** (27 symbols, 18 relationships, 0 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                                  | Use for                                  |
| ----------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/offroute/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/offroute/clusters`       | All functional areas                     |
| `gitnexus://repo/offroute/processes`      | All execution flows                      |
| `gitnexus://repo/offroute/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->

---

# Offroute — Project Architecture

## Full Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Package manager** | Deno | `deno task dev/build`, `deno.lock` |
| **Frontend framework** | Preact 10 + TypeScript 5.6 | Not React — use `preact/hooks`, `preact/compat` |
| **Bundler** | Vite 6 | Port 1420 (fixed for Tauri), `@preact/preset-vite` |
| **Styling** | Tailwind CSS v4 | Via Vite plugin, not PostCSS |
| **State** | Zustand v5 | |
| **Data fetching** | TanStack Query (preact) + Axios | `@tanstack/preact-query` |
| **Validation** | Valibot | |
| **FP / Effects** | Effect-TS | |
| **Icons** | Lucide Preact | `lucide-preact` |
| **Animation** | Framer | `framer` package |
| **Desktop shell** | Tauri v2 | |
| **Rust deps** | tauri 2, tauri-plugin-opener, serde, serde_json | |
| **Backend (external)** | NestJS v11 + Prisma v7 + PostgreSQL | Lives in `_server/`, runs separately |

> **Resolved 2026-08-17:** `prisma` is no longer in the root `package.json`.
> Still do not import Prisma in frontend code — it belongs only to `_server/`.

> **Package manager:** Deno only. `deno.json` holds the task table and
> `deno.lock` is the sole lockfile; `package.json` remains because Deno reads
> it for the npm dependency set. Do **not** run `npm install` at the repo root.
> `_server/` is the exception — it is a standalone Node service with its own
> `package-lock.json`.

---

## Tauri v2 Architecture

### Process Model

```
┌─────────────────────────────────────────────────────────┐
│  OS Process: tauri-app (Rust binary)                    │
│                                                         │
│  ┌─────────────────┐    IPC (invoke/emit)    ┌────────┐ │
│  │  Core (lib.rs)  │ ◄──────────────────────► │WebView│ │
│  │  Tokio runtime  │                          │Preact │ │
│  │  Plugin system  │                          │ App   │ │
│  └─────────────────┘                          └────────┘ │
└─────────────────────────────────────────────────────────┘
```

- **main.rs** — thin entrypoint, calls `lib.rs::run()`. `windows_subsystem = "windows"` hides console in release.
- **lib.rs** — `tauri::Builder` setup: register plugins, register commands, run event loop.
- **WebView** — OS native webview (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux). Renders the Preact app.
- **IPC bridge** — `invoke()` calls Rust commands; `emit()`/`listen()` for events.

### IPC: Commands vs Events

**Commands** (request/response, frontend → Rust):
```rust
// Rust
#[tauri::command]
async fn my_command(arg: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    Ok(format!("result: {}", arg))
}
```
```ts
// Frontend
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<string>("my_command", { arg: "hello" });
```

**Events** (fire-and-forget, bidirectional):
```rust
// Rust → Frontend
app_handle.emit("event-name", payload)?;
// Rust listen to frontend event
app_handle.listen("frontend-event", |event| { ... });
```
```ts
// Frontend → Rust
import { emit, listen } from "@tauri-apps/api/event";
await emit("frontend-event", { data: 123 });
const unlisten = await listen<MyPayload>("event-name", (e) => console.log(e.payload));
```

### Capability / Permission System (v2)

All IPC access is **allow-listed** in `src-tauri/capabilities/*.json`. Default at `capabilities/default.json`:
- `core:default` — window management, events, paths, webview, tray, menu, image, resources
- `opener:default` — open `http://`, `https://`, `mailto:`, `tel://` URLs + reveal files

To add a plugin's permissions, add its identifier to the capability file **and** register the plugin in `lib.rs`.

### Shared State in Rust

```rust
use std::sync::Mutex;

struct AppState {
    counter: Mutex<u32>,
}

// in run():
.manage(AppState { counter: Mutex::new(0) })

// in command:
#[tauri::command]
fn increment(state: tauri::State<'_, AppState>) -> u32 {
    let mut c = state.counter.lock().unwrap();
    *c += 1;
    *c
}
```

Use `Mutex<T>` for mutable state, `RwLock<T>` for read-heavy state. Never hold a lock across `.await`.

---

## What Can Be Built in src-tauri

### Core Native Features (no extra deps)
- **Multi-window** — create windows from Rust or frontend via `tauri::WebviewWindowBuilder`
- **Frameless / transparent windows** — set `decorations: false`, `transparent: true` in `tauri.conf.json`
- **macOS vibrancy / window effects** — `tauri::window::Effect::*` (Sidebar, HudWindow, UnderWindowBackground, etc.)
- **System tray** — `tauri::tray::TrayIconBuilder`, native menu, click handlers
- **Native app menu** — `tauri::menu::MenuBuilder`
- **App badge** (macOS dock) — `window.set_badge_label()`
- **Progress bar** (Windows taskbar) — `window.set_progress_bar()`
- **Window drag region** — `data-tauri-drag-region` HTML attribute
- **Background Tokio tasks** — spawn async work, emit events back to frontend
- **Custom asset protocol** — serve local files via `tauri://` scheme

### Official Plugins (add to Cargo.toml + register in lib.rs + add permission to capability)

| Plugin | Cargo crate | Permission prefix | Use |
|--------|-------------|-------------------|-----|
| File system | `tauri-plugin-fs` | `fs:` | Read/write local files |
| SQLite | `tauri-plugin-sql` | `sql:` | Local DB, replaces NestJS+Postgres for offline data |
| HTTP client | `tauri-plugin-http` | `http:` | Fetch from Rust, bypasses CORS |
| Notifications | `tauri-plugin-notification` | `notification:` | OS native notifications |
| Global shortcuts | `tauri-plugin-global-shortcut` | `global-shortcut:` | System-wide keybindings |
| Clipboard | `tauri-plugin-clipboard-manager` | `clipboard-manager:` | Read/write clipboard |
| Key-value store | `tauri-plugin-store` | `store:` | Persistent JSON store |
| Auto-updater | `tauri-plugin-updater` | `updater:` | OTA updates |
| Single instance | `tauri-plugin-single-instance` | — | Prevent multiple app instances |
| Deep links | `tauri-plugin-deep-link` | `deep-link:` | Custom URL scheme (offroute://) |
| Shell | `tauri-plugin-shell` | `shell:` | Execute shell commands |
| Process | `tauri-plugin-process` | `process:` | Restart, exit app |
| OS info | `tauri-plugin-os` | `os:` | Platform/version detection |
| Opener | `tauri-plugin-opener` | `opener:` | **Already installed** |

### Custom Rust Modules to Build
- **Background service** — long-running Tokio task (e.g. polling NestJS, file watcher, WebSocket client)
- **Local cache layer** — SQLite via tauri-plugin-sql, cache API responses offline
- **IPC command modules** — split into files: `src/commands/`, `src/services/`, register all in `lib.rs`
- **Native file operations** — read/write config files, export data
- **Crypto** — use `ring` or `aes-gcm` crate for local data encryption

---

## Performance: Blazing Fast Setup

### Cargo.toml — Release Profile (add this)
```toml
[profile.release]
opt-level = 3        # max speed optimization
lto = true           # link-time optimization, reduces binary size + faster
codegen-units = 1    # single codegen unit = better optimization
panic = "abort"      # smaller binary, no unwinding
strip = true         # strip debug symbols from binary
```

### tauri.conf.json — Performance Configs
- Only enable `features` you actually use in `tauri = { version = "2", features = [] }` — empty = minimal
- Set `bundle.targets` to only the platform you ship (not `"all"` in production)
- Enable `app.windows[0].visible: false` then show after content loads to avoid blank flash

### Frontend Performance
- Preact is already ~3KB — do NOT switch to React
- Tailwind v4 via Vite plugin = zero-runtime CSS, purged automatically
- TanStack Query handles caching — don't duplicate with manual state
- Use `invoke` for heavy computation, never block JS thread with CPU work
- Prefer Rust for: file I/O, crypto, data processing, HTTP to external APIs

### IPC Performance Tips
- Use `async` commands for anything that does I/O
- Batch multiple values into one `invoke` call instead of multiple round-trips
- Use **events** (fire-and-forget) for streaming/progress updates, not repeated `invoke` polling
- Avoid passing large JSON blobs — use Tauri's `Resource` system or file paths for large data

---

## Current State: What Exists

> **Corrected 2026-08-17.** Everything below used to describe a fresh
> `create-tauri-app` scaffold. It no longer does — the placeholders are gone,
> the CSP is real, and there are six command modules. For the full developer
> reference (all 18 IPC commands, 34 REST endpoints, 16 WebSocket events,
> environment variables, CI/CD), read **`docs.md`**. For feature status, read
> **`TODO.md`**.

```
src-tauri/
├── src/
│   ├── main.rs          # entrypoint, no-console in release
│   ├── lib.rs           # Builder: 6 plugins, 18 commands
│   └── commands/        # bluetooth, control, device, system_status, terminal
├── capabilities/
│   └── default.json     # core, opener, notification, os, store, sql, geolocation
├── Cargo.toml           # + btleplug, tokio, uuid, futures, starship-battery
├── tauri.conf.json      # productName Offroute, id com.offroute.desktop, real CSP
├── gen/android/         # generated Android project, committed for CI
└── build.rs             # tauri_build::build()
```

**Resolved** — these scaffold placeholders no longer exist: `productName` is
`Offroute`, the identifier is `com.offroute.desktop`, the window title is
`Offroute`, `security.csp` is a real policy, and `[profile.release]`
optimizations are set.

**Still outstanding:**
- `Cargo.toml`: `[lib] name = "tauri_app_lib"` is still the scaffold name.
  Renaming it means regenerating `gen/android`, which references the crate.
- `Cargo.toml`: `authors = []`.

---

## File Layout

```
/
├── src/                  # Preact frontend
│   ├── main.tsx          # render(<App />, ...)
│   └── App.tsx           # root component, uses invoke("greet")
├── src-tauri/            # Rust / Tauri v2
│   ├── src/lib.rs        # core: Builder, commands, plugins
│   ├── src/main.rs       # binary entrypoint
│   ├── capabilities/     # ACL permission files per window
│   ├── Cargo.toml        # rust deps
│   └── tauri.conf.json   # app config: window, build, bundle, security
├── _server/              # NestJS backend (runs separately, port 3000)
│   ├── src/              # NestJS modules
│   └── prisma/           # schema.prisma (PostgreSQL, no URL set yet)
├── index.html            # Vite entry HTML
├── vite.config.ts        # Vite: Preact + Tailwind, port 1420
└── package.json          # Deno-managed: preact, zustand, tailwind, tauri deps
```
