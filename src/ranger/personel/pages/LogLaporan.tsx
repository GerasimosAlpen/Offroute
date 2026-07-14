import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck } from "lucide-preact";
import { PersonelPageShell } from "../components/PersonelPageShell";

interface LogEntry {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  type: "info" | "warning" | "success";
}

const UNIT_BADGE: Record<string, string> = {
  "R-BRAVO": "border-[#5fb3b3] text-[#5fb3b3] bg-[#5fb3b3]/10",
  "R-ALPHA": "border-[#ffb2bd] text-[#ffb2bd] bg-[#ffb2bd]/10",
  "R-DELTA": "border-[#fabd00] text-[#fabd00] bg-[#fabd00]/10",
  "R-ECHO": "border-[#66df75] text-[#66df75] bg-[#66df75]/10",
  "HQ COMMAND": "border-[#cb2957] text-[#cb2957] bg-[#cb2957]/10",
};

const DEFAULT_BADGE = "border-[#e1bec2] text-[#e1bec2] bg-[#e1bec2]/10";

const LOG_ENTRIES: LogEntry[] = [
  {
    id: 1,
    timestamp: "14:05 WIB",
    user: "R-BRAVO",
    action: "Laporan Baru",
    details: "Evakuasi Medis Darurat — Tiga orang terjebak dengan luka berat di reruntuhan lantai 2.",
    type: "warning",
  },
  {
    id: 2,
    timestamp: "13:42 WIB",
    user: "R-ALPHA",
    action: "Update Status",
    details: "Distribusi Logistik Terhambat — Jalur tertutup pohon tumbang. Membutuhkan alat berat.",
    type: "info",
  },
  {
    id: 3,
    timestamp: "13:10 WIB",
    user: "HQ COMMAND",
    action: "Koordinasi Sektor",
    details: "Instruksi evakuasi untuk Sektor B dan C telah dikirimkan. Semua unit diminta melapor.",
    type: "warning",
  },
  {
    id: 4,
    timestamp: "12:30 WIB",
    user: "R-DELTA",
    action: "Area Cleared",
    details: "Sektor A — inspeksi selesai. Tidak ditemukan korban tambahan. Area aman.",
    type: "success",
  },
  {
    id: 5,
    timestamp: "11:15 WIB",
    user: "R-BRAVO",
    action: "Permintaan Informasi",
    details: "Warga meminta info jalur evakuasi alternatif. Informasi telah diberikan.",
    type: "success",
  },
];

const typeStyles: Record<string, { dot: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  info: {
    dot: "bg-[#ffb2bd]",
    bg: "bg-[#ffb2bd]/5",
    border: "border-[#ffb2bd]",
    icon: AlertTriangle,
  },
  warning: {
    dot: "bg-[#fabd00]",
    bg: "bg-[#fabd00]/5",
    border: "border-[#fabd00]",
    icon: AlertTriangle,
  },
  success: {
    dot: "bg-[#66df75]",
    bg: "bg-[#66df75]/5",
    border: "border-[#66df75]",
    icon: ShieldCheck,
  },
};

export function LogLaporan() {
  return (
    <PersonelPageShell title="Log Laporan Detail" description="Riwayat aktivitas dan laporan taktis.">
      <div className="relative flex flex-col gap-3">
        {LOG_ENTRIES.map((entry, i) => {
          const style = typeStyles[entry.type];
          const Icon = style.icon;
          const badgeStyle = UNIT_BADGE[entry.user] || DEFAULT_BADGE;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 28 }}
              className={`flex items-start gap-4 p-4 border-l-4 ${style.border} ${style.bg} border border-[#444]`}
            >
              <div className={`w-2 h-2 rounded-full ${style.dot} mt-1.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <span className={`inline-block px-2 py-0.5 border font-mono text-[10px] font-bold mb-2 ${badgeStyle}`}>
                  {entry.user}
                </span>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#e1bec2] mb-2">
                  <span>{entry.timestamp}</span>
                  <span className="w-1 h-1 rounded-full bg-[#444]" />
                  <span>{entry.action}</span>
                </div>
                <p className="font-mono text-sm text-[#e5e2e1]">
                  {entry.details}
                </p>
              </div>
              <Icon size={14} className={`${style.dot.replace("bg-", "text-")} shrink-0 mt-1`} />
            </motion.div>
          );
        })}
      </div>
    </PersonelPageShell>
  );
}
