import { TriangleAlert } from "lucide-preact";

type Severity = "critical" | "warning" | "info";

interface Hazard {
  severity: Severity;
  title: string;
  time: string;
  description: string;
  actions?: { label: string; primary?: boolean }[];
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#ff0040",
  warning: "#fabd00",
  info: "#66df75",
};

const HAZARDS: Hazard[] = [
  {
    severity: "critical",
    title: "KRITIS: KEBAKARAN BLOK A",
    time: "08:42",
    description: "Sektor Utara. Butuh bantuan pemadaman segera.",
    actions: [{ label: "DETAIL" }, { label: "KIRIM UNIT", primary: true }],
  },
  {
    severity: "warning",
    title: "PERINGATAN: AKSES PUTUS",
    time: "08:15",
    description: "Jalan Sudirman terblokir puing. Rute dialihkan.",
  },
  {
    severity: "info",
    title: "INFO: TITIK EVAKUASI AMAN",
    time: "07:50",
    description: "Zona Selatan siap menerima warga sipil.",
  },
];

export function HazardStatusPanel() {
  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-9 flex items-center gap-2 px-4 bg-[#131313] border-b border-[#444]">
        <TriangleAlert size={13} className="text-[#e5e2e1]" />
        <span className="text-[#e5e2e1] text-sm tracking-[1.4px] uppercase">
          Status Taktis
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">
        {HAZARDS.map((hazard) => (
          <div
            key={hazard.title}
            className="shrink-0 bg-[#131313] border-l-4 py-3 pl-4 pr-3 flex flex-col gap-1"
            style={{ borderLeftColor: SEVERITY_COLOR[hazard.severity] }}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className="text-sm uppercase leading-5"
                style={{ color: SEVERITY_COLOR[hazard.severity] }}
              >
                {hazard.title}
              </span>
              <span className="text-[#e1bec2] text-xs shrink-0">
                {hazard.time}
              </span>
            </div>
            <p className="text-[#e1bec2] text-xs leading-4">
              {hazard.description}
            </p>
            {hazard.actions && (
              <div className="flex gap-2 pt-2">
                {hazard.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={
                      action.primary
                        ? "border border-[#ff0040] bg-[#ff0040]/10 text-[#ff0040] text-xs uppercase px-2.5 py-1.5"
                        : "border border-[#444] text-[#e5e2e1] text-xs uppercase px-2.5 py-1.5"
                    }
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
