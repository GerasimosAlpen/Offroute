<div align="center">

# Offroute

**Ekosistem Navigasi dan Komando Evakuasi Bencana Offline**

Navigasi evakuasi yang tetap hidup ketika internet mati.

[![CI](https://github.com/hiyokun-d/Offroute/actions/workflows/ci.yml/badge.svg)](https://github.com/hiyokun-d/Offroute/actions/workflows/ci.yml)
[![Build](https://github.com/hiyokun-d/Offroute/actions/workflows/build.yml/badge.svg)](https://github.com/hiyokun-d/Offroute/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

GEMASTIK — Pengembangan Perangkat Lunak · Tim **Kata Abe Bebas Dah** · Binus University

</div>

---

## Masalahnya

Indonesia berada di pertemuan tiga lempeng tektonik aktif dan di Cincin Api
Pasifik. BNPB mencatat **lebih dari 5.400 bencana sepanjang 2023**, berdampak
pada **lebih dari 8 juta orang**.

Yang membuat korban bertambah bukan hanya bencananya, tapi keterlambatan
responsnya. Dan di situ, aplikasi navigasi biasa justru gagal tepat pada saat
paling dibutuhkan:

| Masalah | Akibat di lapangan |
|---|---|
| Aplikasi navigasi berbasis cloud mati total tanpa internet | Padahal jaringan hampir selalu putus saat bencana besar |
| Peta offline menampilkan kondisi jalan **normal** | Rute "tercepat" bisa mengarah lurus ke jalan yang sudah longsor |
| Tidak ada cara menyebarkan laporan tanpa internet | Satu orang tahu jalan tertutup, seratus orang lain tidak |
| Kanal darurat butuh sinyal seluler | Yang baterainya kritis atau di luar jangkauan tidak punya opsi |

Akibatnya berulang: warga terjebak di jalur yang diblokir, sebagian titik
evakuasi penuh sesak sementara yang lain kosong, dan tim SAR tidak tahu di mana
hambatan sebenarnya berada.

## Solusinya

Offroute adalah ekosistem **dua sisi** — satu untuk yang dievakuasi, satu untuk
yang mengevakuasi — dan dirancang agar fitur intinya berjalan tanpa internet.

Tiga peran, tiga antarmuka, satu sumber data yang sama:

| Peran | Rute | Untuk siapa | Bentuk |
|---|---|---|---|
| **Warga** | `/user` | Masyarakat terdampak | Mobile, responsif |
| **Personel** | `/ranger/personel` | Tim SAR & relawan lapangan | Mobile, tanpa perlu instalasi |
| **Ranger Command** | `/ranger/radar` | Operator BPBD/Basarnas di posko | Desktop, konsol taktis |
| **SOS** | `/sos` | Korban, tanpa akun | Suar darurat sekali pakai |

### Yang bisa dilakukan

- **Rute sadar-bahaya** — bukan sekadar rute tercepat, tapi rute yang
  memperhitungkan laporan bahaya yang masuk. Jalan yang dilaporkan tertutup
  akan dihindari.
- **Lapor Insiden** — siapa pun bisa menandai hambatan di peta. Laporan itu
  langsung mengubah rute yang ditawarkan ke orang lain.
- **Mode FLARE** — deklarasi insiden besar. Semua perangkat yang terhubung
  menerima peringatan, unit terdekat didispatch, dan sekuens evakuasi berjalan.
- **Tactical Map** — operator melihat sebaran unit, titik evakuasi beserta
  kapasitasnya, zona bahaya aktif, dan posisi personel secara realtime.
- **Comm Center** — koordinasi radio antara posko dan lapangan.
- **Titik evakuasi** — dikelola operator, lengkap dengan kapasitas dan status
  keterisian, sehingga rute tidak mengarahkan orang ke tempat yang sudah penuh.
- **Cache offline** — data disimpan di SQLite lokal, dan perubahan yang dibuat
  saat offline diantrekan lalu dikirim ulang begitu koneksi kembali.
- **Gempa BMKG** — data gempa langsung dari BMKG, bukan simulasi.

### WPMTRS, dijelaskan sederhana

*Weighted Path Multi Target Routing System* — inti akademis dari proposal ini.
Tiga gagasan yang digabung:

1. **Bobot, bukan cuma jarak.** Setiap ruas jalan diberi biaya:

   ```
   cost(e) = w₁·waktu(e) + w₂·bahaya(e) + w₃·insiden(e)
   ```

   Jalan pintas yang berbahaya bisa kalah dari jalan memutar yang aman.

2. **Banyak tujuan sekaligus.** Pertanyaannya bukan "bagaimana ke titik X",
   tapi **"titik evakuasi mana yang paling masuk akal untuk saya sekarang"** —
   dievaluasi bersamaan, dan hanya yang masih punya kapasitas yang dihitung.

3. **Pencarian yang dipercepat.** *Contraction Hierarchies* (Geisberger dkk.,
   2008) memampatkan graf jalan lebih dulu, supaya kueri bisa selesai jauh
   lebih cepat daripada Dijkstra biasa.

> **Status jujur:** poin 1 dan 2 sudah tercermin di perilaku aplikasi. Poin 3
> — mesin CH di Rust beserta PBF parser-nya — **belum dibangun**. Routing saat
> ini memakai OSRM dan masih memerlukan internet. Lihat tabel di bawah.

---

## Status: apa yang nyata, apa yang belum

Bagian ini sengaja ditulis apa adanya. Proposal menjelaskan sistem sasaran;
tabel ini menjelaskan kode yang benar-benar ada hari ini.
[`TODO.md`](TODO.md) adalah catatan teknis lengkapnya.

### Sudah nyata dan berjalan

| Komponen | Catatan |
|---|---|
| Backend NestJS + Prisma + PostgreSQL | 11 modul, 34 endpoint REST, gateway Socket.IO dengan 16 event |
| Sinkronisasi realtime | Socket.IO, retry tanpa batas — putus-nyambung adalah kondisi normal, bukan error |
| Tactical map (Leaflet) | Peta nyata, routing nyata, dipakai bersama oleh radar dan personel |
| Lapor Insiden | Tersimpan di database, tersiar ke semua klien |
| Titik & permintaan evakuasi | Alur lengkap: minta, terima/tolak, konfirmasi |
| Comm Center | Riwayat tersimpan, pesan realtime |
| Cache offline (SQLite) | Write-through, plus antrean mutasi yang diputar ulang saat online |
| Feed gempa BMKG | Data langsung dari `data.bmkg.go.id`, **bukan** simulasi |
| Bluetooth Tier 1 | Rust + `btleplug`, peran central/client. Lolos `cargo build`, **belum diuji dengan perangkat keras** |
| Konsol operator | System Monitor, Terminal diagnostik, browser tertanam |

### Sengaja masih simulasi

Bukan bug — keputusan sadar, supaya alur bisa didemokan sebelum perangkat
kerasnya ada.

| Yang disimulasikan | Kenapa |
|---|---|
| Sekuens FLARE / dispatch | Routing di bawahnya nyata; node mesh dan episentrumnya yang dibuat-buat |
| Deteksi korban lewat suar | Butuh Bluetooth Tier 2 yang belum bisa dibangun |
| `MOCK_HAZARDS` di tactical map | Menunggu data bahaya dari lapangan |
| Roster ranger cadangan | Menunggu sistem login |
| "Rute mana yang bisa dilewati" | Masih heuristik jarak, belum kesadaran jaringan jalan sungguhan |

### Belum dibangun

| Fitur | Hambatan |
|---|---|
| **Routing offline (CH + PBF parser)** | Inti WPMTRS di proposal. Butuh model data graf yang belum ada. Sekarang memakai **server demo publik OSRM**, yang menurut ketentuannya sendiri tidak untuk produksi |
| **Sinkronisasi UDP multicast** | Mekanisme mesh di proposal; belum ada modulnya |
| **Login / autentikasi** | Belum ada model User, sesi, maupun guard. Semua endpoint masih terbuka |
| **Bluetooth Tier 2 (korban sebagai suar)** | Butuh peran GATT server yang tidak tersedia di Tauri; iOS melarang BLE advertising di background di level OS |
| **Lokasi perangkat native** | Sementara memakai fallback berbasis IP |

> Offroute adalah proyek mahasiswa, **bukan** peralatan darurat bersertifikasi.
> Jangan menjadikannya pengganti radio SAR, satelit BNPB, atau layanan 112.

---

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Shell aplikasi | Tauri v2 (Rust) — desktop & Android dari satu basis kode |
| UI | Preact 10 + TypeScript 5.6 (**bukan** React) |
| Bundler | Vite 6 |
| Styling | Tailwind CSS v4 |
| State | Zustand v5 |
| Data fetching | TanStack Query + Axios |
| Peta | Leaflet + react-leaflet (lewat `preact/compat`) |
| Router | wouter (hash-based, wajib untuk webview Tauri) |
| Realtime | Socket.IO |
| Backend | NestJS v11 + Prisma v7 + PostgreSQL |
| Cache lokal | SQLite via `tauri-plugin-sql` |
| Bluetooth | `btleplug` (Rust) |
| Package manager | Deno |

## Menjalankan

```bash
# 1. Dependensi frontend
deno install

# 2. Backend (terminal terpisah)
cd _server
npm ci
cp .env.example .env      # isi DATABASE_URL, DIRECT_URL, ADMIN_TOKEN
npx prisma generate
npm run start:dev

# 3. Aplikasi
deno task dev             # browser, http://localhost:1420
deno task tauri dev       # aplikasi desktop
deno task tauri android dev
```

Penjelasan lengkap — setiap variabel environment, arsitektur tiap modul,
troubleshooting, dan cara kerja CI/CD — ada di **[`docs.md`](docs.md)**.

## Unduhan

Setiap rilis menyediakan installer untuk Windows, macOS, Linux, dan Android di
halaman [Releases](https://github.com/hiyokun-d/Offroute/releases). Build dari
setiap PR juga tersedia sebagai artefak di tab
[Actions](https://github.com/hiyokun-d/Offroute/actions).

## Tim

| Nama | NIM | Tanggung jawab |
|---|---|---|
| Muh. Daffa Dwi Syahreza | 2802492062 | Ketua tim — arsitektur, graph & routing engine |
| Gerasimos Alven Raditya Baskara | 2802438501 | Data parser, struktur graph, backend |
| Albertus Adrian Wicaksono | 2802451876 | Front-end, sinkronisasi, dashboard |

Program Studi Computer Science, Binus University, Jakarta.

## Kontribusi

Baca bagian *Contributing* di [`docs.md`](docs.md). Singkatnya: buat branch,
pakai [Conventional Commits](https://www.conventionalcommits.org/), pastikan
`deno task typecheck` dan `deno task test` lolos, lalu buka PR.

## Lisensi

[MIT](LICENSE) — termasuk catatan penting soal penggunaan dalam keadaan darurat.

## Referensi

- BNPB (2023). *Data Informasi Bencana Indonesia (DIBI)*. <https://dibi.bnpb.go.id/>
- Geisberger, R. dkk. (2008). *Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks*. WEA'08.
- Guan, W., Guan, S. & Zhao, J. (2023). *Dynamic Evacuation Path Planning for Multi Exit Building Fire*. Fire Technology 59(5).
- Knopp, S. dkk. (2007). *Computing Many to Many Shortest Paths Using Highway Hierarchies*. ALENEX'07.
- Kurbanov, T., Cuchy, M. & Vokrinek, J. (2022). *Fast One to Many Multicriteria Shortest Path Search*. arXiv:2201.12684.
- Zhou, L. & Liang, X. (2022). *A Dynamic Risk Based Routing Approach for Multi Source and Multi Sink Evacuation*. Reliability Engineering & System Safety.
- OpenStreetMap Contributors. Ekstrak regional Indonesia. <https://download.geofabrik.de/asia/indonesia.html>
