import { useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Flame, Droplets, Car, AlertCircle, Send, MapPin, Clock, ChevronRight } from "lucide-preact";
import { UserPageShell } from "../components/UserPageShell";
import { UrgencyBadge } from "../components/UrgencyBadge";

type ReportType = "fire" | "flood" | "accident" | "theft" | "other";
type ReportTab = "baru" | "riwayat";

interface Report {
  id: number;
  type: ReportType;
  title: string;
  description: string;
  location: string;
  time: string;
  urgency: "tinggi" | "sedang" | "rendah";
  status: "DIPROSES" | "SELESAI" | "BARU";
}

const REPORT_TYPES: { kind: ReportType; label: string; icon: typeof Flame; color: string }[] = [
  { kind: "fire", label: "Kebakaran", icon: Flame, color: "text-[#FF0040] border-[#FF0040]" },
  { kind: "flood", label: "Banjir", icon: Droplets, color: "text-[#4fc3f7] border-[#4fc3f7]" },
  { kind: "accident", label: "Kecelakaan", icon: Car, color: "text-[#fabd00] border-[#fabd00]" },
  { kind: "theft", label: "Pencurian", icon: AlertCircle, color: "text-[#ffb2bd] border-[#ffb2bd]" },
  { kind: "other", label: "Lainnya", icon: AlertTriangle, color: "text-[#e1bec2] border-[#e1bec2]" },
];

const HISTORY: Report[] = [
  { id: 1, type: "fire", title: "Kebakaran Rumah Warga", description: "Api meluas ke lantai 2, butuh bantuan segera.", location: "Jl. Merdeka No. 10", time: "14:05", urgency: "tinggi", status: "DIPROSES" },
  { id: 2, type: "flood", title: "Genangan Air di Jalan", description: "Ketinggian air mencapai 50cm, akses terbatas.", location: "Jl. Sudirman Raya", time: "13:42", urgency: "sedang", status: "DIPROSES" },
  { id: 3, type: "accident", title: "Tabrakan Beruntun", description: "3 kendaraan terlibat, satu korban luka ringan.", location: "Simpang Empat", time: "11:15", urgency: "sedang", status: "SELESAI" },
  { id: 4, type: "theft", title: "Laporan Pencurian Motor", description: "Motor hilang parkir di depan toko.", location: "Pasar Baru", time: "09:30", urgency: "rendah", status: "SELESAI" },
];

const statusColors: Record<string, string> = {
  BARU: "text-[#ffb2bd] border-[#ffb2bd]",
  DIPROSES: "text-[#fabd00] border-[#fabd00]",
  SELESAI: "text-[#66df75] border-[#66df75]",
};

function NewReportForm({
  selectedType,
  setSelectedType,
  description,
  setDescription,
  onSubmit,
}: {
  selectedType: ReportType | null;
  setSelectedType: (t: ReportType | null) => void;
  description: string;
  setDescription: (d: string) => void;
  onSubmit: () => void;
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
      <motion.button
        type="button"
        onClick={onSubmit}
        disabled={!selectedType || !description.trim()}
        whileTap={selectedType && description.trim() ? { scale: 0.97 } : {}}
        className={"w-full font-mono font-bold text-sm tracking-[1px] uppercase flex items-center justify-center gap-2 py-4 transition-all " + (selectedType && description.trim() ? "bg-[#cb2957] text-[#ffe9eb] hover:bg-[#b8174a]" : "bg-[#2a2a2a] text-[#666] cursor-not-allowed")}
      >
        <Send size={16} />
        <span>Kirim Laporan</span>
      </motion.button>
    </motion.div>
  );
}

function HistoryView({ reports, onSelect }: { reports: Report[]; onSelect: (r: Report) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {reports.map((report, i) => {
          const TypeIcon = REPORT_TYPES.find((t) => t.kind === report.type)?.icon ?? AlertTriangle;
          return (
            <motion.button
              key={report.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
              onClick={() => onSelect(report)}
              className="w-full text-left bg-[#262626] border border-[#444] p-4 flex items-center gap-3 hover:border-[#ffb2bd] transition-colors group"
            >
              <div className="w-8 h-8 border border-[#444] flex items-center justify-center bg-[#2a2a2a] shrink-0">
                <TypeIcon size={14} className="text-[#e1bec2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-grotesk font-semibold text-sm text-[#e5e2e1] group-hover:text-[#ffb2bd] transition-colors truncate">{report.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={"font-mono text-[9px] uppercase px-1 py-0.5 border " + statusColors[report.status]}>{report.status}</span>
                  <span className="font-mono text-[9px] text-[#666]">{report.time}</span>
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

function DetailView({ report, onBack }: { report: Report; onBack: () => void }) {
  const TypeIcon = REPORT_TYPES.find((t) => t.kind === report.type)?.icon ?? AlertTriangle;
  return (
    <UserPageShell
      title="Detail Laporan"
      description={"LAPORAN #" + report.id}
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
              <h3 className="font-grotesk font-semibold text-base text-[#e5e2e1]">{report.title}</h3>
              <span className={"font-mono text-[10px] uppercase px-1.5 py-0.5 border inline-block mt-1 " + statusColors[report.status]}>{report.status}</span>
            </div>
          </div>
          <UrgencyBadge level={report.urgency} />
        </div>
        <p className="font-mono text-sm text-[#e1bec2] leading-relaxed">{report.description}</p>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#e1bec2] bg-[#1a1a1a] p-2 border border-[#444]">
          <MapPin size={12} />
          <span>{report.location}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
          <Clock size={12} />
          <span>{report.time} WIB</span>
        </div>
      </motion.div>
    </UserPageShell>
  );
}

export function EmergencyReport() {
  const [tab, setTab] = useState<ReportTab>("baru");
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState("");
  const [showHistory, setShowHistory] = useState<Report | null>(null);

  const handleSubmit = () => {
    if (!selectedType || !description.trim()) return;
    setSelectedType(null);
    setDescription("");
    setTab("riwayat");
  };

  if (showHistory) {
    return <DetailView report={showHistory} onBack={() => setShowHistory(null)} />;
  }

  return (
    <UserPageShell
      title="Laporan Darurat"
      description={tab === "baru" ? "Sampaikan laporan ke pusat komando" : "Riwayat laporan Anda"}
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
          description={description}
          setDescription={setDescription}
          onSubmit={handleSubmit}
        />
      ) : (
        <HistoryView reports={HISTORY} onSelect={setShowHistory} />
      )}
    </UserPageShell>
  );
}
