import { useState } from "preact/hooks";
import { RadarPageShell } from "../components/RadarPageShell";
import { MapPin, AlertTriangle, Camera, Send, Flame, Droplets, Wind, Mountain, ChevronDown, ChevronUp } from "lucide-preact";

type IncidentType = "fire" | "flood" | "quake" | "landslide" | "other";

const INCIDENT_TYPES: { value: IncidentType; label: string; icon: typeof Flame }[] = [
  { value: "fire", label: "Kebakaran", icon: Flame },
  { value: "flood", label: "Banjir", icon: Droplets },
  { value: "quake", label: "Gempa", icon: Wind },
  { value: "landslide", label: "Longsor", icon: Mountain },
  { value: "other", label: "Lainnya", icon: AlertTriangle },
];

const URGENCY_LEVELS = ["RENDAH", "SEDANG", "TINGGI", "KRITIS"] as const;

const UNIT_BADGE_COLORS: Record<string, string> = {
  "R-ALPHA": "border-[#ffb2bd] text-[#ffb2bd] bg-[#ffb2bd]/10",
  "R-BRAVO": "border-[#5fb3b3] text-[#5fb3b3] bg-[#5fb3b3]/10",
  "R-DELTA": "border-[#fabd00] text-[#fabd00] bg-[#fabd00]/10",
  "R-ECHO": "border-[#66df75] text-[#66df75] bg-[#66df75]/10",
};

interface SubmittedReport {
  id: number;
  unit: string;
  origin: string;
  time: string;
  type: IncidentType;
  urgency: string;
  explanation: string;
}

const SUBMITTED: SubmittedReport[] = [
  { id: 1, unit: "R-BRAVO", origin: "SEKTOR C, BLOK 4", time: "14:05 WIB", type: "fire", urgency: "KRITIS", explanation: "Tiga orang terjebak dengan luka berat di reruntuhan lantai 2. Butuh tim ekstraksi segera." },
  { id: 2, unit: "R-ALPHA", origin: "JALUR UTAMA A-B", time: "13:42 WIB", type: "flood", urgency: "TINGGI", explanation: "Jalur tertutup pohon tumbang. Kendaraan logistik tidak bisa melintas." },
  { id: 3, unit: "R-DELTA", origin: "SEKTOR A", time: "12:30 WIB", type: "other", urgency: "SEDANG", explanation: "Inspeksi selesai. Tidak ditemukan korban tambahan." },
];

export function LaporIncident() {
  const [type, setType] = useState<IncidentType | null>(null);
  const [urgency, setUrgency] = useState<string>("SEDANG");
  const [location, setLocation] = useState("");
  const [explanation, setExplanation] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  return (
    <RadarPageShell
      title="Lapor Incident"
      description="Mark floods, tsunamis, earthquakes, and other incidents."
    >
      <div className="max-w-3xl flex flex-col gap-8">
        <section>
          <label className="font-mono text-xs text-[#e1bec2] uppercase tracking-wider mb-3 block">
            Jenis Insiden
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {INCIDENT_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex flex-col items-center gap-2 p-4 border transition-colors ${
                  type === value
                    ? "border-[#ffb2bd] bg-[#ffb2bd]/10 text-[#ffb2bd]"
                    : "border-[#444] bg-[#262626] text-[#e1bec2] hover:border-[#ffb2bd]"
                }`}
              >
                <Icon size={24} />
                <span className="font-mono text-xs">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="font-mono text-xs text-[#e1bec2] uppercase tracking-wider mb-3 block">
            Tingkat Urgensi
          </label>
          <div className="flex gap-2">
            {URGENCY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setUrgency(level)}
                className={`flex-1 py-3 border font-mono text-xs font-bold transition-colors ${
                  urgency === level
                    ? level === "KRITIS"
                      ? "border-[#FF0040] bg-[#FF0040]/20 text-[#FF0040]"
                      : level === "TINGGI"
                        ? "border-[#fabd00] bg-[#fabd00]/10 text-[#fabd00]"
                        : level === "SEDANG"
                          ? "border-[#ffb2bd] bg-[#ffb2bd]/10 text-[#ffb2bd]"
                          : "border-[#66df75] bg-[#66df75]/10 text-[#66df75]"
                    : "border-[#444] bg-[#262626] text-[#e1bec2] hover:border-[#ffb2bd]"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="font-mono text-xs text-[#e1bec2] uppercase tracking-wider mb-3 block">
            Lokasi Insiden
          </label>
          <div className="flex gap-2">
            <input
              value={location}
              onInput={(e) => setLocation((e.target as HTMLInputElement).value)}
              className="flex-1 bg-[#262626] border border-[#444] px-4 py-3 font-mono text-sm text-[#e5e2e1] placeholder:text-[#e1bec2]/50 focus:border-[#ffb2bd] focus:ring-0 transition-colors"
              placeholder="Grid / koordinat / landmark..."
            />
            <button
              type="button"
              className="px-4 bg-[#262626] border border-[#444] text-[#ffb2bd] hover:border-[#ffb2bd] transition-colors flex items-center gap-2 font-mono text-xs"
            >
              <MapPin size={16} /> PINDAI
            </button>
          </div>
        </section>

        <section>
          <label className="font-mono text-xs text-[#e1bec2] uppercase tracking-wider mb-3 block">
            Penjelasan
          </label>
          <textarea
            value={explanation}
            onInput={(e) => setExplanation((e.target as HTMLTextAreaElement).value)}
            rows={4}
            className="w-full bg-[#262626] border border-[#444] px-4 py-3 font-mono text-sm text-[#e5e2e1] placeholder:text-[#e1bec2]/50 focus:border-[#ffb2bd] focus:ring-0 transition-colors resize-none"
            placeholder="Detail insiden, jumlah korban, akses jalan, dll."
          />
        </section>

        <section className="flex items-center justify-between border-t border-[#444] pt-6">
          <button className="flex items-center gap-2 px-4 py-3 border border-[#444] bg-[#262626] text-[#e1bec2] hover:border-[#ffb2bd] transition-colors font-mono text-xs">
            <Camera size={16} /> LAMPIRKAN MEDIA
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-[#cb2957] text-[#ffe9eb] font-mono text-sm hover:bg-[#b8174a] transition-colors border-none">
            <Send size={16} /> KIRIM LAPORAN
          </button>
        </section>

        <section className="border-t border-[#444] pt-6">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 font-mono text-xs text-[#e1bec2] uppercase tracking-wider hover:text-[#ffb2bd] transition-colors"
          >
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Riwayat Laporan Masuk ({SUBMITTED.length})
          </button>

          {showHistory && (
            <div className="mt-4 flex flex-col gap-3">
              {SUBMITTED.map((report) => (
                <div
                  key={report.id}
                  className="border border-[#444] bg-[#262626] p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={`px-2 py-0.5 border font-mono text-[10px] font-bold ${UNIT_BADGE_COLORS[report.unit] || "border-[#e1bec2] text-[#e1bec2]"}`}
                    >
                      {report.unit}
                    </span>
                    <span className="font-mono text-[10px] text-[#e1bec2]">
                      {report.time}
                    </span>
                    <span className="font-mono text-[10px] text-[#a8898c]">
                      dari {report.origin}
                    </span>
                  </div>
                  <p className="font-mono text-sm text-[#e5e2e1]">
                    {report.explanation}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="font-mono text-[9px] text-[#e1bec2] border border-[#444] px-1.5 py-0.5 bg-[#131313]">
                      {INCIDENT_TYPES.find((t) => t.value === report.type)?.label || report.type}
                    </span>
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 border ${
                      report.urgency === "KRITIS"
                        ? "border-[#FF0040] text-[#FF0040] bg-[#FF0040]/10"
                        : report.urgency === "TINGGI"
                          ? "border-[#fabd00] text-[#fabd00] bg-[#fabd00]/10"
                          : "border-[#444] text-[#e1bec2]"
                    }`}>
                      {report.urgency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </RadarPageShell>
  );
}
