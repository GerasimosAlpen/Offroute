<!--
Judul PR: pakai Conventional Commits, misal
  feat(radar): tambah filter urgensi di Squad Logs
  fix(personel): perbaiki heading marker saat GPS hilang
  ci: cache Rust build biar Android tidak 15 menit
-->

## Apa yang berubah

<!-- Satu-dua kalimat. Anggap yang baca belum lihat kodenya. -->

## Kenapa

<!-- Masalah apa yang diselesaikan? Kalau ada issue terkait: Closes #123 -->

## Bagian mana yang tersentuh

- [ ] Frontend (`src/`)
- [ ] Rust / Tauri (`src-tauri/`)
- [ ] Backend NestJS (`_server/`)
- [ ] CI / workflows (`.github/`)
- [ ] Dokumentasi

## Cara mengujinya

<!--
Langkah konkret supaya reviewer bisa mengulang.
Contoh:
  1. deno task dev
  2. buka /#/ranger/radar/map
  3. klik FLARE, pastikan sequence jalan dan ranger bergerak
-->

1.
2.
3.

## Checklist

- [ ] `deno task typecheck` lolos (tsc pakai `strict` + `noUnusedLocals`)
- [ ] `deno task build` lolos
- [ ] Kalau menyentuh Rust: `cargo check` di `src-tauri/` lolos
- [ ] Kalau menyentuh `_server/`: `npm run build` dan `npm test` lolos
- [ ] Sudah dicoba manual di browser **dan** di app Tauri (perilakunya bisa beda —
      lihat `isTauri` di `src/lib/tauri.ts`)

## Data: nyata atau simulasi?

<!--
PENTING untuk proyek ini. Sebagian fitur sengaja masih simulasi (FLARE,
deteksi korban, MOCK_HAZARDS). Kalau PR ini menambah data simulasi, tulis di
sini DAN catat di TODO.md — supaya tidak ada yang mengira itu sudah nyata.
-->

- [ ] Semua data di PR ini nyata (dari backend / sensor / API)
- [ ] Ada yang masih simulasi — sudah saya catat di `TODO.md`, bagiannya:

## Catatan buat reviewer

<!-- Ada yang kamu ragu? Bagian mana yang paling perlu dilihat teliti? -->
