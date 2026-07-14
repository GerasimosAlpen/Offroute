import { motion } from "framer-motion";
import { X, Navigation } from "lucide-preact";
import { DANGER_COLORS, type EventMarker } from "./types";

export function EventPopup({
  event,
  onClose,
  onNavigate,
}: {
  event: EventMarker;
  userPos: [number, number];
  onClose: () => void;
  onNavigate: () => void;
}) {
  const c = DANGER_COLORS[event.danger];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="fixed bottom-[72px] left-3 right-3 z-[1500] bg-[#1a1a1a] border"
      style={{ borderColor: c.border, boxShadow: c.glow }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between border-b"
        style={{ borderColor: `${c.border}44`, background: c.bg }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[9px] font-bold px-1.5 py-0.5 border"
            style={{ color: c.text, borderColor: c.border }}
          >
            {event.danger}
          </span>
          <span className="font-grotesk font-semibold text-[#e5e2e1] text-sm leading-none">
            {event.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#555] hover:text-[#e1bec2] transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-2 font-mono text-[10px] text-[#e1bec2]">
        <div className="flex justify-between border-b border-[#2a2a2a] pb-1.5">
          <span className="text-[#555]">TIPE:</span>
          <span style={{ color: c.text }}>{event.type}</span>
        </div>
        <div className="flex justify-between border-b border-[#2a2a2a] pb-1.5">
          <span className="text-[#555]">JARAK:</span>
          <span className="text-[#e5e2e1] font-bold">{event.distance}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">TERDAMPAK:</span>
          <span className="text-[#e5e2e1]">{event.affected} orang</span>
        </div>
      </div>

      {/* Navigate button */}
      <div className="px-3 pb-3">
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-center gap-2 py-2.5 font-mono text-xs uppercase tracking-wider font-bold border transition-all hover:brightness-110 active:scale-95"
          style={{
            color: c.text,
            borderColor: c.border,
            background: c.bg,
          }}
        >
          <Navigation size={13} />
          Navigasi
        </button>
      </div>
    </motion.div>
  );
}
