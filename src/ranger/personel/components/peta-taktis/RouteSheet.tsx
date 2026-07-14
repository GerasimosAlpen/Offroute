import { motion } from "framer-motion";
import { X, ChevronRight, Clock, Shield, Skull, AlertTriangle } from "lucide-preact";
import { metersBetween } from "@/lib/routing";
import { DANGER_COLORS, type EventMarker, type RouteOption } from "./types";

function buildRouteOptions(_event: EventMarker, distKm: number): RouteOption[] {
  const base = Math.round(distKm * 3 + 4); // rough minutes
  return [
    {
      id: "fastest",
      label: "Tercepat",
      sublabel: "Rute paling singkat, melalui zona bahaya",
      time: `${base} mnt`,
      distance: `${distKm.toFixed(1)} km`,
      danger: "tinggi",
      dangerLabel: "BAHAYA TINGGI",
      color: "#FF0040",
      borderColor: "border-[#FF0040]",
      icon: Skull,
    },
    {
      id: "moderate",
      label: "Lebih Aman",
      sublabel: "Memutar sedikit, hindari zona panas",
      time: `${base + Math.round(base * 0.4)} mnt`,
      distance: `${(distKm * 1.4).toFixed(1)} km`,
      danger: "sedang",
      dangerLabel: "BAHAYA SEDANG",
      color: "#fabd00",
      borderColor: "border-[#fabd00]",
      icon: AlertTriangle,
    },
    {
      id: "safest",
      label: "Paling Aman",
      sublabel: "Jalur memutar, zona aman sepenuhnya",
      time: `${base + Math.round(base * 0.9)} mnt`,
      distance: `${(distKm * 1.9).toFixed(1)} km`,
      danger: "rendah",
      dangerLabel: "AMAN",
      color: "#66df75",
      borderColor: "border-[#66df75]",
      icon: Shield,
    },
  ];
}

export function RouteSheet({
  event,
  userPos,
  onClose,
  onSelectRoute,
}: {
  event: EventMarker;
  userPos: [number, number];
  onClose: () => void;
  onSelectRoute: (route: RouteOption) => void;
}) {
  const distKm = metersBetween(userPos, event.pos) / 1000;
  const options = buildRouteOptions(event, distKm);
  const c = DANGER_COLORS[event.danger];

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="fixed inset-x-0 bottom-0 z-[2000] bg-[#131313] border-t-2"
      style={{ borderColor: c.border }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-[#444]" />
      </div>

      {/* Header */}
      <div className="px-5 pb-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: c.text }}>
            {event.danger} · {event.type}
          </span>
          <span className="font-grotesk font-bold text-[#e5e2e1] text-base leading-tight">{event.name}</span>
          <span className="font-mono text-[10px] text-[#555]">{event.distance} dari lokasi Anda</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center border border-[#333] text-[#555] hover:text-[#e1bec2] hover:border-[#ffb2bd] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Route title */}
      <div className="px-5 pt-4 pb-2">
        <span className="font-mono text-[10px] text-[#555] uppercase tracking-widest">
          Pilih jalur navigasi
        </span>
      </div>

      {/* Route options */}
      <div className="px-4 pb-24 flex flex-col gap-2.5">
        {options.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 400, damping: 30 }}
              onClick={() => onSelectRoute(opt)}
              className={`w-full flex items-center gap-3 p-3.5 bg-[#1e1e1e] border ${opt.borderColor} hover:brightness-110 active:scale-95 transition-all text-left`}
            >
              <div
                className="w-9 h-9 flex items-center justify-center shrink-0 border"
                style={{ borderColor: opt.color, background: `${opt.color}18` }}
              >
                <Icon size={14} style={{ color: opt.color } as any} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-grotesk font-bold text-[#e5e2e1] text-sm">{opt.label}</span>
                  <span
                    className="font-mono text-[8px] px-1.5 py-0.5 border"
                    style={{ color: opt.color, borderColor: opt.color, background: `${opt.color}18` }}
                  >
                    {opt.dangerLabel}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[#666] leading-tight">{opt.sublabel}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <div className="flex items-center gap-1">
                  <Clock size={10} style={{ color: opt.color } as any} />
                  <span className="font-mono text-[11px] font-bold" style={{ color: opt.color }}>
                    {opt.time}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#555]">{opt.distance}</span>
              </div>
              <ChevronRight size={14} className="text-[#444] shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
