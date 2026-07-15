import { useMemo, useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Flame, AlertTriangle, ShieldAlert, Zap, Clock } from "lucide-preact";
import { PersonelPageShell } from "../components/PersonelPageShell";
import { CheckCircle2, Hand, Loader2 } from "lucide-preact";
import { useIncidents } from "@/hooks/useIncidents";
import { useTasksStore } from "@/store/tasks";
import { useDeviceLocation } from "@/store/location";
import { getSelfRanger } from "@/lib/rangers";
import { formatCoords } from "@/lib/format";
import type { HazardData, HazardKind, HazardSeverity } from "@/lib/hazards";

type DangerLevel = "KRITIS" | "TINGGI" | "SEDANG" | "RENDAH";
type EventType = "KEBAKARAN" | "BENCANA" | "MEDIS" | "KEAMANAN";

interface Event {
  id: string;
  name: string;
  type: EventType;
  danger: DangerLevel;
  location: string;
  time: string;
  description: string;
  affected?: number;
  status: "AKTIF" | "DIPROSES" | "TERKENDALI";
}

const KIND_TO_TYPE: Record<HazardKind, EventType> = {
  fire: "KEBAKARAN",
  blocked: "BENCANA",
  medical: "MEDIS",
  crash: "KEAMANAN",
  theft: "KEAMANAN",
};

const SEVERITY_TO_DANGER: Record<HazardSeverity, DangerLevel> = {
  critical: "KRITIS",
  warning: "TINGGI",
  info: "SEDANG",
};

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

/**
 * The field unit's own controls on an incident card: take the job on your
 * own initiative (self-assign — then radar doesn't send anyone else), report
 * it done (→ awaiting radar confirmation), or just navigate. Mirrors exactly
 * what radar's Status Taktis shows for the same incident.
 */
function TaskActions({
  hazard,
  color,
  border,
  bg,
}: {
  hazard: HazardData;
  color: string;
  border: string;
  bg: string;
}) {
  const { coords } = useDeviceLocation();
  const [self] = useState(getSelfRanger);
  const tasks = useTasksStore((s) => s.tasks);
  const resolved = useTasksStore((s) => s.resolvedHazards);
  const selfAssign = useTasksStore((s) => s.selfAssign);
  const reportDone = useTasksStore((s) => s.reportDone);

  const task = tasks[hazard.id];
  const isResolved = Boolean(resolved[hazard.id]);
  // This unit is unavailable to take a new job if it's already on one.
  const busyElsewhere = Object.values(tasks).some(
    (t) => t.rangerId === self.id && t.hazardId !== hazard.id && t.status !== "reported",
  );

  if (isResolved) {
    return (
      <div className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#66df75] bg-[#66df75]/10 text-[#66df75] font-mono text-xs uppercase tracking-wider">
        <CheckCircle2 size={12} /> Selesai · dikonfirmasi HQ
      </div>
    );
  }

  if (task?.status === "reported") {
    return (
      <div className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#fabd00] bg-[#fabd00]/10 text-[#fabd00] font-mono text-xs uppercase tracking-wider">
        <Loader2 size={12} className="animate-spin" /> Menunggu konfirmasi HQ
      </div>
    );
  }

  // A unit is on it (this one or another) — offer "done" only to the unit
  // actually handling it, never a second dispatch.
  if (task) {
    const mine = task.rangerId === self.id;
    if (mine) {
      return (
        <button
          type="button"
          onClick={() => reportDone(hazard.id, hazard)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#66df75] bg-[#66df75]/10 text-[#66df75] font-mono text-xs uppercase tracking-wider hover:brightness-125 active:scale-95 transition-all"
        >
          <CheckCircle2 size={12} /> Tandai Selesai
        </button>
      );
    }
    return (
      <div className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#444] bg-[#1a1a1a] text-[#5fb3b3] font-mono text-xs uppercase tracking-wider">
        Ditangani {task.rangerName} ({task.callsign})
      </div>
    );
  }

  // Nobody on it yet — take it yourself (radar then won't send anyone).
  return (
    <button
      type="button"
      disabled={!coords || busyElsewhere}
      onClick={() =>
        coords &&
        selfAssign(
          hazard.id,
          self,
          [coords.lat, coords.lon],
          [coords.lat + hazard.offset[0], coords.lon + hazard.offset[1]],
          hazard.label,
        )}
      className={`w-full flex items-center justify-center gap-2 py-2.5 border ${border} ${color} ${bg} font-mono text-xs uppercase tracking-wider hover:brightness-125 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100`}
    >
      <Hand size={12} /> {busyElsewhere ? "Anda sedang bertugas" : "Ambil Tugas"}
    </button>
  );
}

export function DangerLevel() {
  const [filter, setFilter] = useState<DangerLevel | "SEMUA">("SEMUA");
  const [selected, setSelected] = useState<Event | null>(null);
  const { coords } = useDeviceLocation();

  // Same live incident feed radar dispatches from (offline-cached), with
  // handling status derived from the shared task/resolution stores — a unit
  // in the field sees exactly what the command center sees.
  const { data: hazards = [] } = useIncidents();
  const tasks = useTasksStore((s) => s.tasks);
  const resolved = useTasksStore((s) => s.resolvedHazards);

  const EVENTS: Event[] = useMemo(
    () =>
      hazards.map((h) => {
        const status: Event["status"] = resolved[h.id]
          ? "TERKENDALI"
          : tasks[h.id]
          ? "DIPROSES"
          : "AKTIF";
        const location = coords
          ? formatCoords(coords.lat + h.offset[0], coords.lon + h.offset[1])
          : "Menunggu GPS...";
        return {
          id: h.id,
          name: h.label,
          type: KIND_TO_TYPE[h.kind],
          danger: SEVERITY_TO_DANGER[h.severity],
          location,
          time: h.time,
          description: h.description,
          status,
        };
      }),
    [hazards, tasks, resolved, coords?.lat, coords?.lon],
  );

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
                  {event.affected !== undefined && (
                    <div className="flex items-center gap-1 text-[#555] font-mono text-[9px]">
                      <span>{event.affected} terdampak</span>
                    </div>
                  )}
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
                        {(() => {
                          const hazard = hazards.find((h) => h.id === event.id);
                          return hazard ? (
                            <TaskActions hazard={hazard} color={cfg.color} border={cfg.border} bg={cfg.bg} />
                          ) : null;
                        })()}
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
