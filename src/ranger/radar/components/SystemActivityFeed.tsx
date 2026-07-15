import { useEffect, useRef, useState } from "preact/hooks";
import { Activity, AlertTriangle, LifeBuoy, Users, Shield, Radio, Flame, Siren } from "lucide-preact";
import { useSystemActivity, startSystemActivity, type ActivityDomain, type ActivityItem } from "@/store/systemActivity";
import { formatRelativeAge } from "@/lib/format";

const DOMAIN_ICON: Record<ActivityDomain, typeof Activity> = {
  incident: AlertTriangle,
  sos: LifeBuoy,
  unit: Shield,
  evac: Users,
  flare: Flame,
  backup: Siren,
  presence: Radio,
};

const TONE_COLOR: Record<ActivityItem["tone"], string> = {
  info: "#5fb3b3",
  good: "#66df75",
  warn: "#fabd00",
  alert: "#ff0040",
};

const DOMAIN_LABEL: Record<ActivityDomain, string> = {
  incident: "INSIDEN",
  sos: "SOS",
  unit: "UNIT",
  evac: "EVAKUASI",
  flare: "FLARE",
  backup: "BACKUP",
  presence: "HADIR",
};

const FILTERS: Array<{ key: ActivityDomain | "ALL"; label: string }> = [
  { key: "ALL", label: "Semua" },
  { key: "incident", label: "Insiden" },
  { key: "sos", label: "SOS" },
  { key: "unit", label: "Unit" },
  { key: "evac", label: "Evak" },
  { key: "backup", label: "Backup" },
  { key: "flare", label: "Flare" },
  { key: "presence", label: "Hadir" },
];

/**
 * The whole-operation activity feed: every action from every role on one
 * live timeline (see src/store/systemActivity.ts). Read-only observer of all
 * the domain WS events — the reusable body behind radar's System Monitor.
 */
export function SystemActivityFeed() {
  const items = useSystemActivity((s) => s.items);
  const [filter, setFilter] = useState<ActivityDomain | "ALL">("ALL");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startSystemActivity();
  }, []);

  const visible = filter === "ALL" ? items : items.filter((i) => i.domain === filter);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [visible.length]);

  return (
    <div className="h-full bg-[#262626] flex flex-col overflow-hidden">
      <div className="shrink-0 flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-[#444] bg-[#131313]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide border transition-colors ${
              filter === f.key
                ? "border-[#5fb3b3] text-[#5fb3b3] bg-[#5fb3b3]/10"
                : "border-[#333] text-[#666] hover:border-[#555] hover:text-[#999]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 p-2 font-mono text-[11px]">
        {visible.length === 0 && (
          <span className="text-[#555] text-[10px] p-2">Menunggu aktivitas dari lapangan...</span>
        )}
        {visible.map((item) => {
          const Icon = DOMAIN_ICON[item.domain];
          const color = TONE_COLOR[item.tone];
          return (
            <div key={item.id} className="flex items-start gap-2 px-1.5 py-1 border-l-2" style={{ borderLeftColor: color }}>
              <Icon size={12} className="mt-0.5 shrink-0" style={{ color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="uppercase tracking-wide text-[9px] shrink-0" style={{ color }}>
                    {DOMAIN_LABEL[item.domain]}
                  </span>
                  <span className="text-[#e5e2e1] font-semibold truncate">{item.actor}</span>
                  <span className="ml-auto text-[#555] text-[9px] shrink-0">{formatRelativeAge(item.ts)}</span>
                </div>
                <p className="text-[#c0b0b3] leading-tight">{item.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
