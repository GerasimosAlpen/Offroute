import { motion } from "framer-motion";

type UrgencyLevel = "tinggi" | "sedang" | "rendah";

interface UrgencyBadgeProps {
  level: UrgencyLevel;
  pulse?: boolean;
}

const URGENCY_STYLES: Record<UrgencyLevel, { text: string; border: string; bg: string; label: string }> = {
  tinggi: {
    text: "text-[#ffb4ab]",
    border: "border-[#ffb4ab]",
    bg: "bg-[#330000]",
    label: "URGENSI TINGGI",
  },
  sedang: {
    text: "text-[#fabd00]",
    border: "border-[#fabd00]",
    bg: "bg-[#1c1b1b]",
    label: "URGENSI SEDANG",
  },
  rendah: {
    text: "text-[#66df75]",
    border: "border-[#66df75]",
    bg: "bg-[#00390f]/20",
    label: "URGENSI RENDAH",
  },
};

/**
 * Animated urgency badge with colour-coded levels and optional pulse effect
 * for critical reports — spring entrance by default.
 */
export function UrgencyBadge({ level, pulse }: UrgencyBadgeProps) {
  const style = URGENCY_STYLES[level];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
        ...(pulse ? { boxShadow: ["0 0 0 0 rgba(255,180,171,0.4)", "0 0 0 6px rgba(255,180,171,0)", "0 0 0 0 rgba(255,180,171,0.4)"] } : {}),
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
        ...(pulse ? { boxShadow: { duration: 1.2, repeat: Infinity } } : {}),
      }}
      className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${style.border} ${style.bg} ${style.text} inline-block`}
    >
      {style.label}
    </motion.span>
  );
}
