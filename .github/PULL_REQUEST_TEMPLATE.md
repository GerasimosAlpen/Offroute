<!--
PR title: use Conventional Commits, e.g.
  feat(radar): add urgency filter to Squad Logs
  fix(personel): correct heading marker when GPS drops
  ci: cache the Rust build so Android is not 15 minutes
-->

## What changed

<!-- One or two sentences. Assume the reader has not seen the code. -->

## Why

<!-- What problem does this solve? If there is a related issue: Closes #123 -->

## Areas touched

- [ ] Frontend (`src/`)
- [ ] Rust / Tauri (`src-tauri/`)
- [ ] NestJS backend (`_server/`)
- [ ] CI / workflows (`.github/`)
- [ ] Documentation

## How to test it

<!--
Concrete steps so a reviewer can reproduce.
Example:
  1. deno task dev
  2. open /#/ranger/radar/map
  3. hit FLARE, confirm the sequence runs and the ranger moves
-->

1.
2.
3.

## Checklist

- [ ] `deno task typecheck` passes (tsc runs with `strict` + `noUnusedLocals`)
- [ ] `deno task test` passes
- [ ] `deno task build` passes
- [ ] If Rust was touched: `cargo check` passes in `src-tauri/`
- [ ] If `_server/` was touched: `npm run build` and `npm test` pass
- [ ] Tried manually in the browser **and** in the Tauri app (behaviour differs —
      see `isTauri` in `src/lib/tauri.ts`)

## Real data or simulated?

<!--
IMPORTANT for this project. Some features are intentionally simulated (FLARE,
victim detection, MOCK_HAZARDS). If this PR adds simulated data, say so here
AND record it in TODO.md, so nobody later mistakes it for real.
-->

- [ ] Everything in this PR is real data (backend / sensor / API)
- [ ] Something is still simulated — recorded in `TODO.md` under:

## Notes for the reviewer

<!-- Anything you are unsure about? Which part deserves the closest look? -->
