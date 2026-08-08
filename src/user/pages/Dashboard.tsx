import { useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Battery, MapPin, Clock, AlertTriangle } from "lucide-preact";
import { StatusHeader } from "../components/StatusHeader";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

interface ActivityEntry {
  id: number;
  text: string;
  time: string;
  type: "info" | "warning" | "success";
}

const RECENT_ACTIVITY: ActivityEntry[] = [
  { id: 1, text: "Laporan kebakaran di Sektor Utara sedang diproses.", time: "14:05", type: "warning" },
  { id: 2, text: "Koneksi terputus selama 2 menit — tersambung kembali.", time: "13:42", type: "info" },
  { id: 3, text: "Tim evakuasi telah dikirim ke lokasi Anda.", time: "12:30", type: "success" },
  { id: 4, text: "Peringatan cuaca ekstrem — waspada angin kencang.", time: "11:15", type: "warning" },
  { id: 5, text: "Jalur evakuasi alternatif telah diperbarui.", time: "10:00", type: "info" },
];

const activityColors: Record<string, string> = {
  info: "border-l-[#ffb2bd] bg-[#ffb2bd]/5",
  warning: "border-l-[#fabd00] bg-[#fabd00]/5",
  success: "border-l-[#66df75] bg-[#66df75]/5",
};

const activityDot: Record<string, string> = {
  info: "bg-[#ffb2bd]",
  warning: "bg-[#fabd00]",
  success: "bg-[#66df75]",
};

export function Dashboard() {
  const online = useOnlineStatus();
  const [filter, setFilter] = useState<"semua" | "info" | "warning" | "success">("semua");
  const filtered = RECENT_ACTIVITY.filter((a) => filter === "semua" || a.type === filter);

  return (
    <div className="flex flex-col bg-[#131313]">
      <StatusHeader />

      <div className="p-4 grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.05 }}
          className="bg-[#262626] border border-[#444] p-4 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            {online ? <Wifi size={18} className="text-[#66df75]" /> : <WifiOff size={18} className="text-[#ff8fa3]" />}
            <motion.span
              className={"size-2 rounded-full " + (online ? "bg-[#66df75]" : "bg-[#FF0040]")}
              animate={online ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
              transition={online ? { duration: 1.6, repeat: Infinity } : { duration: 0 }}
            />
          </div>
          <span className="font-grotesk font-bold text-lg text-[#e5e2e1]">{online ? "Terhubung" : "Offline"}</span>
          <span className="font-mono text-[10px] text-[#e1bec2]">{online ? "Koneksi stabil" : "Mode terbatas"}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.1 }}
          className="bg-[#262626] border border-[#444] p-4 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <Battery size={18} className="text-[#66df75]" />
            <span className="font-mono text-[10px] text-[#66df75]">76%</span>
          </div>
          <span className="font-grotesk font-bold text-lg text-[#e5e2e1]">Sinyal Kuat</span>
          <span className="font-mono text-[10px] text-[#e1bec2]">Jaringan 4G - Jakarta</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.15 }}
          className="bg-[#262626] border border-[#444] p-4 flex flex-col gap-2"
        >
          <MapPin size={18} className="text-[#ffb2bd]" />
          <span className="font-grotesk font-bold text-lg text-[#e5e2e1] truncate">Jakarta Pusat</span>
          <span className="font-mono text-[10px] text-[#e1bec2]">Diperbarui 2 menit lalu</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.2 }}
          className="bg-[#262626] border border-[#444] p-4 flex flex-col gap-2"
        >
          <Clock size={18} className="text-[#fabd00]" />
          <span className="font-grotesk font-bold text-lg text-[#e5e2e1]">Laporan Aktif</span>
          <span className="font-mono text-[10px] text-[#e1bec2]">3 laporan hari ini</span>
        </motion.div>
      </div>

      <div className="px-4 mb-4">
        <h2 className="font-mono text-[10px] text-[#e1bec2] uppercase tracking-wider mb-3">Aksi Cepat</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Lapor Darurat", icon: AlertTriangle, color: "text-[#FF0040] border-[#FF0040]", route: "/user/report" },
            { label: "Lihat Map", icon: MapPin, color: "text-[#ffb2bd] border-[#ffb2bd]", route: "/user/map" },
            { label: "Mode Flare", icon: Clock, color: "text-[#fabd00] border-[#fabd00]", route: "/user/flare" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.label}
                href={"#" + action.route}
                className={"flex flex-col items-center gap-2 bg-[#262626] border p-4 text-center hover:bg-[#2a2a2a] transition-colors " + action.color}
              >
                <Icon size={22} strokeWidth={2} />
                <span className={"font-mono text-[10px] uppercase tracking-wider " + action.color}>{action.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-[10px] text-[#e1bec2] uppercase tracking-wider">Aktivitas Terkini</h2>
          <div className="flex gap-2">
            {(["semua", "info", "warning", "success"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={"font-mono text-[9px] uppercase px-1.5 py-0.5 border transition-colors " + (filter === f ? "text-[#ffb2bd] border-[#ffb2bd] bg-[#ffb2bd]/10" : "text-[#666] border-[#444] hover:text-[#e1bec2]")}
              >
                {f === "semua" ? "Semua" : f === "info" ? "Info" : f === "warning" ? "Warn" : "OK"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((entry, i) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 28 }}
                className={"flex items-start gap-3 border-l-4 p-3 border border-[#444] " + activityColors[entry.type]}
              >
                <div className={"w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 " + activityDot[entry.type]} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[12px] text-[#e5e2e1] leading-relaxed">{entry.text}</p>
                </div>
                <span className="font-mono text-[9px] text-[#666] shrink-0 mt-0.5">{entry.time}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
