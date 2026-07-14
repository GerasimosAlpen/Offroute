import { useState } from "preact/hooks";
import { RadarPageShell } from "../components/RadarPageShell";
import { MapPin, Camera, Send, Flame, Construction, HeartPulse, CarFront, ShieldAlert, ChevronDown, ChevronUp } from "lucide-preact";
import { incidentsApi, type CreateIncidentDto } from "@/lib/api";
import { useIncidents } from "@/hooks/useIncidents";
import type { HazardKind, HazardSeverity } from "@/lib/hazards";

// Uses the same HazardKind taxonomy as everywhere else in the app (the
// tactical map, Status Taktis panel) and the backend's HazardKindDto — this
// used to be its own disconnected fire/flood/quake/landslide/other union
// that didn't match anything else and couldn't actually be submitted anywhere.
const INCIDENT_TYPES: { value: HazardKind; label: string; icon: typeof Flame }[] = [
  { value: "fire", label: "Kebakaran", icon: Flame },
  { value: "blocked", label: "Jalur Terblokir", icon: Construction },
  { value: "medical", label: "Evakuasi Medis", icon: HeartPulse },
  { value: "crash", label: "Kecelakaan", icon: CarFront },
  { value: "theft", label: "Pencurian", icon: ShieldAlert },
];

const URGENCY_LEVELS = ["RENDAH", "SEDANG", "TINGGI", "KRITIS"] as const;
type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

/** Backend only has 3 severity levels; collapses this form's 4-level urgency UI down to them at submit time. */
function urgencyToSeverity(urgency: UrgencyLevel): HazardSeverity {
  if (urgency === "KRITIS") return "critical";
  if (urgency === "RENDAH") return "info";
  return "warning"; // SEDANG, TINGGI
}

export function LaporIncident() {
  const [type, setType] = useState<HazardKind | null>(null);
  const [urgency, setUrgency] = useState<UrgencyLevel>("SEDANG");
  const [location, setLocation] = useState("");
  const [explanation, setExplanation] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real incident history — same live/fallback data source as the tactical
  // map and Status Taktis panel, instead of a second hardcoded mock list.
  const { data: incidents = [] } = useIncidents();

  async function handleSubmit() {
    if (!type || !explanation.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const typeLabel = INCIDENT_TYPES.find((t) => t.value === type)?.label ?? type;
      const dto: CreateIncidentDto = {
        kind: type,
        label: `${typeLabel} — ${urgency}`,
        // No dedicated backend column for the free-text location field, so
        // it's folded into the description rather than adding a new one.
        description: location.trim() ? `[${location.trim()}] ${explanation.trim()}` : explanation.trim(),
        severity: urgencyToSeverity(urgency),
        // Incident offsets are relative to whichever viewer is rendering
        // them (see src/lib/hazards.ts), not absolute coordinates — there's
        // no correct way yet to turn a real GPS fix into one. Submitting
        // 0,0 ("reported at my own position") matches the same limitation
        // the existing mock HAZARDS already have, not a regression.
        offsetLat: 0,
        offsetLon: 0,
      };
      await incidentsApi.create(dto);
      setType(null);
      setExplanation("");
      setLocation("");
      setUrgency("SEDANG");
    } catch (err) {
      console.warn("[LaporIncident] Failed to submit report:", err);
      setSubmitError("Gagal mengirim laporan — coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

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

        <section className="flex flex-col items-end gap-2 border-t border-[#444] pt-6">
          <div className="flex items-center justify-between w-full">
            <button className="flex items-center gap-2 px-4 py-3 border border-[#444] bg-[#262626] text-[#e1bec2] hover:border-[#ffb2bd] transition-colors font-mono text-xs">
              <Camera size={16} /> LAMPIRKAN MEDIA
            </button>
            <button
              type="button"
              disabled={!type || !explanation.trim() || submitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-3 bg-[#cb2957] text-[#ffe9eb] font-mono text-sm hover:bg-[#b8174a] transition-colors border-none disabled:opacity-40"
            >
              <Send size={16} /> {submitting ? "MENGIRIM..." : "KIRIM LAPORAN"}
            </button>
          </div>
          {submitError && <span className="font-mono text-xs text-[#FF0040]">{submitError}</span>}
        </section>

        <section className="border-t border-[#444] pt-6">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 font-mono text-xs text-[#e1bec2] uppercase tracking-wider hover:text-[#ffb2bd] transition-colors"
          >
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Riwayat Laporan Masuk ({incidents.length})
          </button>

          {showHistory && (
            <div className="mt-4 flex flex-col gap-3">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="border border-[#444] bg-[#262626] p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-sm text-[#e5e2e1] font-bold">
                      {incident.label}
                    </span>
                    <span className="font-mono text-[10px] text-[#e1bec2]">
                      {incident.time}
                    </span>
                  </div>
                  <p className="font-mono text-sm text-[#e5e2e1]">
                    {incident.description}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="font-mono text-[9px] text-[#e1bec2] border border-[#444] px-1.5 py-0.5 bg-[#131313]">
                      {INCIDENT_TYPES.find((t) => t.value === incident.kind)?.label ?? incident.kind}
                    </span>
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 border ${
                      incident.severity === "critical"
                        ? "border-[#FF0040] text-[#FF0040] bg-[#FF0040]/10"
                        : incident.severity === "warning"
                          ? "border-[#fabd00] text-[#fabd00] bg-[#fabd00]/10"
                          : "border-[#444] text-[#e1bec2]"
                    }`}>
                      {incident.severity.toUpperCase()}
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
