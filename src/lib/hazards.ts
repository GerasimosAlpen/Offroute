export type HazardKind = "fire" | "blocked" | "medical" | "crash" | "theft";
export type HazardSeverity = "critical" | "warning" | "info";

// TODO(backend): these are placeholder incidents, offset from the ranger's
// own position just so something renders nearby. Once the Lapor Incident
// report endpoint exists (README phase 2/3 — NestJS `ranger` module +
// Report/Incident model), replace this with real incident coordinates
// fetched from there instead of static offsets.
//
// Single shared source for both the tactical map's markers and the Status
// Taktis sidebar panel — these used to be two separate, disconnected mock
// lists that didn't refer to the same incidents. Now they do.
export interface HazardData {
  id: string;
  kind: HazardKind;
  label: string;
  description: string;
  time: string;
  severity: HazardSeverity;
  /** [lat, lon] offset from the ranger's own position. */
  offset: [number, number];
}

export const HAZARDS: HazardData[] = [
  {
    id: "a01",
    kind: "fire",
    label: "A01 - API",
    description: "Sektor Utara. Butuh bantuan pemadaman segera.",
    time: "08:42",
    severity: "critical",
    offset: [0.004, -0.002],
  },
  {
    id: "road1",
    kind: "blocked",
    label: "JALUR PUTUS",
    description: "Jalan Sudirman terblokir puing. Rute dialihkan.",
    time: "08:15",
    severity: "warning",
    offset: [-0.003, 0.005],
  },
  {
    id: "med1",
    kind: "medical",
    label: "EVAK MEDIS",
    description: "Zona Selatan siap menerima warga sipil.",
    time: "07:50",
    severity: "info",
    offset: [-0.001, -0.006],
  },
  {
    id: "crash1",
    kind: "crash",
    label: "KECELAKAAN",
    description: "Tabrakan dua kendaraan, satu jalur tertutup.",
    time: "09:05",
    severity: "warning",
    offset: [0.0025, 0.0075],
  },
  {
    id: "theft1",
    kind: "theft",
    label: "LAPORAN PENCURIAN",
    description: "Laporan warga, pelaku dilaporkan kabur ke arah timur.",
    time: "09:20",
    severity: "warning",
    offset: [-0.006, 0.0015],
  },
];

/** What the dispatched ranger reports once they arrive — flavor text keyed by hazard kind. */
export function arrivalReportFor(hazard: HazardData): string {
  switch (hazard.kind) {
    case "fire":
      return "api berhasil dikendalikan, tidak ada korban.";
    case "blocked":
      return "jalur sudah dibuka kembali.";
    case "medical":
      return "evakuasi selesai, warga sipil aman.";
    case "crash":
      return "kecelakaan ditangani, korban sudah dievakuasi.";
    case "theft":
      return "tiba di lokasi, mengumpulkan keterangan saksi.";
  }
}
