import { useState } from "preact/hooks";
import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-preact";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
}

export function NavItem({ href, label, icon: Icon, collapsed }: NavItemProps) {
  const [active] = useRoute(href);
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      className="relative block w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        layout
        whileHover={{ x: active || collapsed ? 0 : 3 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`relative flex items-center gap-3 w-full py-4 font-mono font-medium text-sm tracking-[0.7px] whitespace-nowrap ${
          collapsed ? "justify-center px-0" : "pl-7 pr-6"
        } ${active ? "text-[#ffe9eb]" : "text-[#e1bec2] hover:bg-white/5"}`}
      >
        {active && (
          <motion.div
            layoutId="nav-active-pill"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute inset-0 bg-[#cb2957] border-l-4 border-[#FF0040]"
          />
        )}
        <Icon size={18} strokeWidth={2} className="relative z-10 shrink-0" />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="label"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {collapsed && hovered && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded bg-[#1a1a1a] border border-[#444] text-[#e1bec2] text-xs font-mono whitespace-nowrap z-50 pointer-events-none"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  );
}
