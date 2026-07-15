import { useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Flame, Construction, HeartPulse, CarFront, ShieldAlert, Send, MapPin, Clock, ChevronRight } from "lucide-preact";
import { UserPageShell } from "../components/UserPageShell";
import { UrgencyBadge } from "../components/UrgencyBadge";
import { useIncidents, submitIncident } from "@/hooks/useIncidents";
import { useTasksStore } from "@/store/tasks";
import { useDeviceLocation } from "@/store/location";
import type { CreateIncidentDto } from "@/lib/api";
import type { HazardData, HazardKind, HazardSeverity } from "@/lib/hazards";

type ReportTab = "baru" | "riwayat";
type Urgency = "tinggi" | "sedang" | "rendah";

// Same HazardKind taxonomy as radar's Lapor Incident and the backend's
// HazardKindDto — a citizen report lands in the exact same incident feed
// radar dispatches units from, not a disconnected mock list.
const REPORT_TYPES: { kind: HazardKind; label: string; icon: typeof Flame; color: string }[] = [
  { kind: "fire", label: "Kebakaran", icon: Flame, color: "text-[#FF0040] border-[#FF0040]" },
  { kind: "blocked", label: "Jalur Putus", icon: Construction, color: "text-[#4fc3f7] border-[#4fc3f7]" },
  { kind: "medical", label: "Medis", icon: HeartPulse, color: "text-[#fabd00] border-[#fabd00]" },
  { kind: "crash", label: "Kecelakaan", icon: CarFront, color: "text-[#ffb2bd] border-[#ffb2bd]" },
  { kind: "theft", label: "Pencurian", icon: ShieldAlert, color: "text-[#e1bec2] border-[#e1bec2]" },
];

const URGENCIES: Urgency[] = ["tinggi", "sedang", "rendah"];

function urgencyToSeverity(u: Urgency): HazardSeverity {
  if (u === "tinggi") return "critical";
  if (u === "sedang") return "warning";
  return "info";
}

function severityToUrgency(s: HazardSeverity): Urgency {
  if (s === "critical") return "tinggi";
  if (s === "warning") return "sedang";
  return "rendah";
}

const statusColors: Record<string, string> = {
  BARU: "text-[#ffb2bd] border-[#ffb2bd]",
  DIPROSES: "text-[#fabd00] border-[#fabd00]",
  SELESAI: "text-[#66df75] border-[#66df75]",
};

type IncidentStatus = "BARU" | "DIPROSES" | "SELESAI";

/** Live handling status straight from the shared task/resolution stores — the same state radar acts on. */
function useIncidentStatus(): (id: string) => IncidentStatus {
  const tasks = useTasksStore((s) => s.tasks);
  const resolved = useTasksStore((s) => s.resolvedHazards);
  return (id) => {
    if (resolved[id]) return "SELESAI";
    if (tasks[id]?.status === "enroute") return "DIPROSES";
    return "BARU";
  };
}

function NewReportForm({
  selectedType,
  setSelectedType,
  urgency,
  setUrgency,
  description,
  setDescription,
  onSubmit,
  submitting,
  notice,
}: {
  selectedType: HazardKind | null;
  setSelectedType: (t: HazardKind | null) => void;
  urgency: Urgency;
  setUrgency: (u: Urgency) => void;
  description: string;
  setDescription: (d: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  notice: string | null;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      <div>
        <h3 className="font-mono text-[10px] text-[#e1bec2] uppercase tracking-wider mb-3">Jenis Laporan</h3>
        <div className="grid grid-cols-3 gap-2">
          {REPORT_TYPES.map((rt, i) => {
            const Icon = rt.icon;
            const isActive = selectedType === rt.kind;
            return (
              <motion.button
                key={rt.kind}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedType(rt.kind)}
                whileTap={{ scale: 0.95 }}
                className={"flex flex-col items-center gap-1.5 p-3 border transition-all " + (isActive ? rt.color + " bg-[#2a2a2a]" : "border-[#444] bg-[#262626] hover:border-[#666]")}
              >
                <Icon size={20} className={isActive ? rt.color : "text-[#e1bec2]"} />
                <span className={"font-mono text-[9px] uppercase tracking-wider " + (isActive ? rt.color : "text-[#e1bec2]")}>{rt.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="font-mono text-[10px] text-[#e1bec2] uppercase tracking-wider mb-2">Tingkat Urgensi</h3>
        <div className="flex gap-2">
          {URGENCIES.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUrgency(u)}
              className={"flex-1 py-2 border font-mono text-[10px] uppercase tracking-wider transition-colors " + (
                urgency === u
                  ? u === "tinggi"
                    ? "border-[#FF0040] bg-[#FF0040]/10 text-[#FF0040]"
                    : u === "sedang"
                    ? "border-[#fabd00] bg-[#fabd00]/10 text-[#fabd00]"
                    : "border-[#66df75] bg-[#66df75]/10 text-[#66df75]"
                  : "border-[#444] bg-[#262626] text-[#666] hover:border-[#666]"
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="font-mono text-[10px] text-[#e1bec2] uppercase tracking-wider mb-2 block">Deskripsi Kejadian</label>
        <textarea
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          placeholder="Jelaskan apa yang terjadi..."
          rows={4}
          className="w-full bg-[#1a1a1a] border border-[#444] text-[#e5e2e1] font-mono text-sm p-3 focus:ring-0 focus:border-[#ffb2bd] placeholder:text-[#666] transition-colors resize-none"
        />
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px] text-[#666] bg-[#1a1a1a] p-3 border border-[#444]">
        <MapPin size={12} className="text-[#ffb2bd]" />
        <span>Lokasi akan dikirim otomatis menggunakan GPS Anda</span>
      </div>
      {notice && (
        <div className="font-mono text-[10px] text-[#fabd00] bg-[#fabd00]/10 border border-[#fabd00]/40 p-3">
          {notice}
        </div>
      )}
      <motion.button
        type="button"
        onClick={onSubmit}
        disabled={!selectedType || !description.trim() || submitting}
        whileTap={selectedType && description.trim() && !submitting ? { scale: 0.97 } : {}}
        className={"w-full font-mono font-bold text-sm tracking-[1px] uppercase flex items-center justify-center gap-2 py-4 transition-all " + (selectedType && description.trim() && !submitting ? "bg-[#cb2957] text-[#ffe9eb] hover:bg-[#b8174a]" : "bg-[#2a2a2a] text-[#666] cursor-not-allowed")}
      >
        <Send size={16} />
        <span>{submitting ? "Mengirim..." : "Kirim Laporan"}</span>
      </motion.button>
    </motion.div>
  );
}

function HistoryView({
  incidents,
  statusOf,
  onSelect,
}: {
  incidents: HazardData[];
  statusOf: (id: string) => IncidentStatus;
  onSelect: (h: HazardData) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {incidents.map((incident, i) => {
          const TypeIcon = REPORT_TYPES.find((t) => t.kind === incident.kind)?.icon ?? AlertTriangle;
          const status = statusOf(incident.id);
          return (
            <motion.button
              key={incident.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
              onClick={() => onSelect(incident)}
              className="w-full text-left bg-[#262626] border border-[#444] p-4 flex items-center gap-3 hover:border-[#ffb2bd] transition-colors group"
            >
              <div className="w-8 h-8 border border-[#444] flex items-center justify-center bg-[#2a2a2a] shrink-0">
                <TypeIcon size={14} className="text-[#e1bec2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-grotesk font-semibold text-sm text-[#e5e2e1] group-hover:text-[#ffb2bd] transition-colors truncate">{incident.label}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={"font-mono text-[9px] uppercase px-1 py-0.5 border " + statusColors[status]}>{status}</span>
                  <span className="font-mono text-[9px] text-[#666]">{incident.time}</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-[#666] group-hover:text-[#ffb2bd] shrink-0" />
            </motion.button>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

function DetailView({
  incident,
  status,
  onBack,
}: {
  incident: HazardData;
  status: IncidentStatus;
  onBack: () => void;
}) {
  const TypeIcon = REPORT_TYPES.find((t) => t.kind === incident.kind)?.icon ?? AlertTriangle;
  return (
    <UserPageShell
      title="Detail Laporan"
      description={"LAPORAN " + incident.id.slice(0, 8).toUpperCase()}
      action={
        <button onClick={onBack} className="font-mono text-[10px] text-[#ffb2bd] uppercase tracking-wider">
          Kembali
        </button>
      }
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#262626] border border-[#444] p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border border-[#444] flex items-center justify-center bg-[#2a2a2a]">
              <TypeIcon size={16} className="text-[#ffb2bd]" />
            </div>
            <div>
              <h3 className="font-grotesk font-semibold text-base text-[#e5e2e1]">{incident.label}</h3>
              <span className={"font-mono text-[10px] uppercase px-1.5 py-0.5 border inline-block mt-1 " + statusColors[status]}>{status}</span>
            </div>
          </div>
          <UrgencyBadge level={severityToUrgency(incident.severity)} />
        </div>
        <p className="font-mono text-sm text-[#e1bec2] leading-relaxed">{incident.description}</p>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
          <Clock size={12} />
          <span>{incident.time} WIB</span>
        </div>
      </motion.div>
    </UserPageShell>
  );
}

export function EmergencyReport() {
  const [tab, setTab] = useState<ReportTab>("baru");
  const [selectedType, setSelectedType] = useState<HazardKind | null>(null);
  const [urgency, setUrgency] = useState<Urgency>("sedang");
  const [description, setDescription] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<HazardData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { coords } = useDeviceLocation();

  // Same live incident feed radar's tactical map, Status Taktis, and Lapor
  // Incident history all read — with the SQLite offline cache underneath.
  const { data: incidents = [] } = useIncidents();
  const statusOf = useIncidentStatus();

  const handleSubmit = async () => {
    if (!selectedType || !description.trim() || submitting) return;
    setSubmitting(true);
    setNotice(null);
    const typeLabel = REPORT_TYPES.find((t) => t.kind === selectedType)?.label ?? selectedType;
    const dto: CreateIncidentDto = {
      kind: selectedType,
      label: `Laporan Warga — ${typeLabel}`,
      description: coords
        ? `${description.trim()} [dilaporkan dari ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}]`
        : description.trim(),
      severity: urgencyToSeverity(urgency),
      // Incident offsets are relative to whichever viewer renders them (see
      // src/lib/hazards.ts) — 0,0 means "at the reporter's position", the
      // same convention radar's Lapor Incident uses.
      offsetLat: 0,
      offsetLon: 0,
    };
    const result = await submitIncident(dto);
    setSubmitting(false);
    setSelectedType(null);
    setDescription("");
    setUrgency("sedang");
    if (result === "queued") {
      setNotice("Offline — laporan tersimpan di perangkat, terkirim otomatis saat sinyal kembali.");
      setTab("baru");
    } else {
      setTab("riwayat");
    }
  };

  if (selectedIncident) {
    return (
      <DetailView
        incident={selectedIncident}
        status={statusOf(selectedIncident.id)}
        onBack={() => setSelectedIncident(null)}
      />
    );
  }

  return (
    <UserPageShell
      title="Laporan Darurat"
      description={tab === "baru" ? "Sampaikan laporan ke pusat komando" : "Laporan insiden aktif di area Anda"}
      action={
        <div className="flex gap-2">
          <button
            onClick={() => setTab("baru")}
            className={"font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors " + (tab === "baru" ? "text-[#ffb2bd] border-[#ffb2bd] bg-[#ffb2bd]/10" : "text-[#666] border-[#444] hover:text-[#e1bec2]")}
          >
            Baru
          </button>
          <button
            onClick={() => setTab("riwayat")}
            className={"font-mono text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors " + (tab === "riwayat" ? "text-[#ffb2bd] border-[#ffb2bd] bg-[#ffb2bd]/10" : "text-[#666] border-[#444] hover:text-[#e1bec2]")}
          >
            Riwayat
          </button>
        </div>
      }
    >
      {tab === "baru" ? (
        <NewReportForm
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          urgency={urgency}
          setUrgency={setUrgency}
          description={description}
          setDescription={setDescription}
          onSubmit={() => void handleSubmit()}
          submitting={submitting}
          notice={notice}
        />
      ) : (
        <HistoryView incidents={incidents} statusOf={statusOf} onSelect={setSelectedIncident} />
      )}
    </UserPageShell>
  );
}
