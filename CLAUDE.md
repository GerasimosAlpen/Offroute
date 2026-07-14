@AGENTS.md

---

# Active Roadmap: Ranger Feature

## Status (corrected 2026-07-14 — see TODO.md for full detail, this section was badly stale)

Everything described as "zero implementation" / "deferred" below this line used to be true but no longer is. As of 2026-07-14: routing, data model, backend REST + WebSocket realtime, radar UI (tactical map, dispatch, FLARE, comms, evac points/requests, Lapor Incident), a real SQLite offline cache, and a real (compile-verified, hardware-untested) desktop BLE Tier 1 relay all exist. `TODO.md` is the accurate, maintained source of truth for what's built vs. simulated vs. still deferred — **read that first**, not this file, for current state. This section is kept only for the two genuinely still-open items below.

**Still open:**
- **Personel platform decision** — `personel` is spec'd as "phone version" but this repo is a Tauri **desktop** app. No platform decision has been made (separate mobile target vs. web view) — don't assume until confirmed. This blocks real personel-side hardware work (native Bluetooth peripheral/beacon mode, native sensors) but does *not* block the personel web UI already built (`src/ranger/personel/`), which runs fine as a desktop-rendered view today.
- **Bluetooth Tier 2 (victim-as-beacon)** — intentionally not built. See TODO.md's "Bluetooth — two tiers" section: needs a native mobile peripheral/GATT-server role (Swift CoreBluetooth, Kotlin BLE) that doesn't exist in Tauri, and iOS enforces a hard OS-level restriction on background BLE advertising that no framework can bypass. Desktop-to-desktop BLE relay (not just talking to a third-party peripheral) is also not yet possible — `btleplug` (used for the built Tier 1) is central/client-only; hosting a GATT server needs `bluer` (Linux only) or native FFI (macOS/Windows).
