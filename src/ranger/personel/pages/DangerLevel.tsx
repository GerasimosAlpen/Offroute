import { useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Flame, AlertTriangle, ShieldAlert, Zap, Clock, Navigation } from "lucide-preact";
import { PersonelPageShell } from "../components/PersonelPageShell";

type DangerLevel = "KRITIS" | "TINGGI" | "SEDANG" | "RENDAH";
type EventType = "KEBAKARAN" | "BENCANA" | "MEDIS" | "KEAMANAN";

interface Event {
  id: number;
  name: string;
  type: EventType;
  danger: DangerLevel;
  location: string;
  coords: { lat: number; lon: number };
  time: string;
  description: string;
  affected: number;
  status: "AKTIF" | "DIPROSES" | "TERKENDALI";
}

const EVENTS: Event[] = [
  {
    id: 1,
    name: "Kebakaran Gedung Kantor",
    type: "KEBAKARAN",
    danger: "KRITIS",
    location: "Jl. Sudirman No. 45, Sektor C",
    coords: { lat: -6.1818, lon: 106.8223 },
    time: "14:05 WIB",
    description: "Kebakaran aktif di lantai 3–5. Api sudah meluas ke gedung sebelah. Evakuasi darurat diperlukan.",
    affected: 37,
    status: "AKTIF",
  },
  {
    id: 2,
    name: "Longsor Jalur Evakuasi",
    type: "BENCANA",
    danger: "TINGGI",
    location: "Jalur Utama Sektor A–B",
    coords: { lat: -6.1858, lon: 106.8183 },
    time: "13:42 WIB",
    description: "Longsor menutup jalur utama evakuasi. Kendaraan berat tidak bisa melintas.",
    affected: 12,
    status: "DIPROSES",
  },
  {
    id: 3,
    name: "Korban Luka Berat",
    type: "MEDIS",
    danger: "TINGGI",
    location: "Sektor C, Blok 4",
    coords: { lat: -6.1798, lon: 106.8263 },
    time: "13:10 WIB",
    description: "Tiga orang terjebak dengan luka berat di reruntuhan lantai 2. Tim medis diminta segera.",
    affected: 3,
    status: "AKTIF",
  },
  {
    id: 4,
    name: "Kerusuhan Warga Posko",
    type: "KEAMANAN",
    danger: "SEDANG",
    location: "Posko Induk Selatan",
    coords: { lat: -6.1838, lon: 106.8243 },
    time: "12:30 WIB",
    description: "Kerumunan warga tidak terkontrol di posko induk. Diperlukan koordinasi distribusi bantuan.",
    affected: 80,
    status: "DIPROSES",
  },
  {
    id: 5,
    name: "Bocor Gas LPG",
    type: "KEAMANAN",
    danger: "SEDANG",
    location: "Perumahan Blok F-12",
    coords: { lat: -6.1808, lon: 106.8203 },
    time: "11:55 WIB",
    description: "Bocor gas terdeteksi di kawasan perumahan padat penduduk. Area sudah dikosongkan.",
    affected: 15,
    status: "TERKENDALI",
  },
];

const DANGER_CONFIG: Record<DangerLevel, {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  bar: string;
  level: number;
}> = {
  KRITIS: {
    label: "KRITIS",
    color: "text-[#FF0040]",
    bg: "bg-[#FF0040]/10",
    border: "border-[#FF0040]",
    glow: "shadow-[0_0_12px_rgba(255,0,64,0.35)]",
    bar: "bg-[#FF0040]",
    level: 100,
  },
  TINGGI: {
    label: "TINGGI",
    color: "text-[#ffb2bd]",
    bg: "bg-[#ffb2bd]/10",
    border: "border-[#ffb2bd]",
    glow: "shadow-[0_0_8px_rgba(255,178,189,0.25)]",
    bar: "bg-[#ffb2bd]",
    level: 70,
  },
  SEDANG: {
    label: "SEDANG",
    color: "text-[#fabd00]",
    bg: "bg-[#fabd00]/10",
    border: "border-[#fabd00]",
    glow: "",
    bar: "bg-[#fabd00]",
    level: 40,
  },
  RENDAH: {
    label: "RENDAH",
    color: "text-[#66df75]",
    bg: "bg-[#66df75]/10",
    border: "border-[#66df75]",
    glow: "",
    bar: "bg-[#66df75]",
    level: 15,
  },
};

const TYPE_ICONS: Record<EventType, typeof Flame> = {
  KEBAKARAN: Flame,
  BENCANA: AlertTriangle,
  MEDIS: ShieldAlert,
  KEAMANAN: Zap,
};

const STATUS_COLORS: Record<string, string> = {
  AKTIF: "text-[#FF0040]",
  DIPROSES: "text-[#fabd00]",
  TERKENDALI: "text-[#66df75]",
};

function DangerBar({ level, color }: { level: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${level}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      />
    </div>
  );
}

export function DangerLevel() {
  const [filter, setFilter] = useState<DangerLevel | "SEMUA">("SEMUA");
  const [selected, setSelected] = useState<Event | null>(null);

  const filtered = EVENTS.filter((e) => filter === "SEMUA" || e.danger === filter);

  const critCount = EVENTS.filter((e) => e.danger === "KRITIS" && e.status === "AKTIF").length;
  const highCount = EVENTS.filter((e) => e.danger === "TINGGI").length;

  return (
    <PersonelPageShell
      title="Tingkat Bahaya"
      description="Status bahaya aktif dan event taktis lapangan."
    >
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-2">
        <div className="bg-[#FF0040]/10 border border-[#FF0040]/40 p-3 flex flex-col gap-1">
          <span className="font-mono text-[9px] text-[#FF0040] uppercase tracking-widest">Kritis Aktif</span>
          <span className="font-grotesk font-bold text-2xl text-[#FF0040]">{critCount}</span>
        </div>
        <div className="bg-[#ffb2bd]/10 border border-[#ffb2bd]/40 p-3 flex flex-col gap-1">
          <span className="font-mono text-[9px] text-[#ffb2bd] uppercase tracking-widest">Tinggi</span>
          <span className="font-grotesk font-bold text-2xl text-[#ffb2bd]">{highCount}</span>
        </div>
        <div className="bg-[#262626] border border-[#444] p-3 flex flex-col gap-1">
          <span className="font-mono text-[9px] text-[#e1bec2] uppercase tracking-widest">Total Event</span>
          <span className="font-grotesk font-bold text-2xl text-[#e5e2e1]">{EVENTS.length}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-1">
        {(["SEMUA", "KRITIS", "TINGGI", "SEDANG", "RENDAH"] as const).map((f) => {
          const cfg = f !== "SEMUA" ? DANGER_CONFIG[f] : null;
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-all ${
                isActive
                  ? f === "SEMUA"
                    ? "border-[#e1bec2] text-[#e5e2e1] bg-[#2a2a2a]"
                    : `${cfg!.border} ${cfg!.color} ${cfg!.bg}`
                  : "border-[#333] text-[#555] hover:border-[#444] hover:text-[#999]"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Event cards */}
      <motion.div layout className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((event, i) => {
            const cfg = DANGER_CONFIG[event.danger];
            const Icon = TYPE_ICONS[event.type];
            const isCrit = event.danger === "KRITIS";
            return (
              <motion.article
                key={event.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 360, damping: 30 }}
                onClick={() => setSelected(selected?.id === event.id ? null : event)}
                className={`bg-[#1e1e1e] border ${cfg.border} p-4 flex flex-col gap-3 cursor-pointer transition-all hover:brightness-110 ${cfg.glow} ${
                  isCrit ? "animate-pulse-border" : ""
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 flex items-center justify-center ${cfg.bg} border ${cfg.border} shrink-0`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-grotesk font-bold text-[#e5e2e1] text-sm leading-tight">
                        {event.name}
                      </span>
                      <span className={`font-mono text-[9px] uppercase tracking-widest ${cfg.color}`}>
                        {event.type}
                      </span>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 border ${cfg.border} ${cfg.bg} flex flex-col items-end gap-0.5 shrink-0`}>
                    <span className={`font-mono text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    {isCrit && (
                      <span className="font-mono text-[8px] text-[#FF0040] animate-pulse">● BAHAYA</span>
                    )}
                  </div>
                </div>

                {/* Danger level bar */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-[#555] uppercase tracking-wider shrink-0">Bahaya</span>
                  <DangerBar level={cfg.level} color={cfg.bar} />
                  <span className={`font-mono text-[9px] ${cfg.color} shrink-0`}>{cfg.level}%</span>
                </div>

                {/* Location + time */}
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 text-[#e1bec2]">
                    <MapPin size={10} />
                    <span className="truncate max-w-[160px]">{event.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#555]">
                    <Clock size={10} />
                    <span>{event.time}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between border-t border-[#333] pt-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-[#555] uppercase">Status:</span>
                    <span className={`font-mono text-[10px] font-bold ${STATUS_COLORS[event.status]}`}>
                      {event.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[#555] font-mono text-[9px]">
                    <span>{event.affected} terdampak</span>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {selected?.id === event.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className={`border-t ${cfg.border} pt-3 flex flex-col gap-3`}>
                        <p className="font-mono text-xs text-[#c0b0b3] leading-relaxed">
                          {event.description}
                        </p>
                        <button className={`w-full flex items-center justify-center gap-2 py-2.5 border ${cfg.border} ${cfg.color} ${cfg.bg} font-mono text-xs uppercase tracking-wider hover:brightness-125 active:scale-95 transition-all`}>
                          <Navigation size={12} />
                          Navigasi ke Lokasi
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </PersonelPageShell>
  );
}
