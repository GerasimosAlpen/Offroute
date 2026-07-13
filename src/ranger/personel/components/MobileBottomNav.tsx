import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Compass, Flame, AlertTriangle, Users } from "lucide-preact";

const TABS = [
  { href: "/ranger/personel/peta", label: "Peta", icon: Compass },
  { href: "/ranger/personel/bahaya", label: "Bahaya", icon: Flame },
  { href: "/ranger/personel/log", label: "Lapor", icon: AlertTriangle },
  { href: "/ranger/personel/komunikasi", label: "Komunikasi", icon: Users },
];

export function MobileBottomNav() {
  const [location, navigate] = useLocation();

  const activeTab = TABS.find((t) => location.startsWith(t.href));

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 bg-[#131313] border-t-2 border-[#444] z-50">
      {TABS.map((tab) => {
        const isActive = activeTab?.href === tab.href;
        const Icon = tab.icon;
        return (
          <button
            key={tab.href}
            onClick={() => navigate(tab.href)}
            className={`flex flex-col items-center justify-center w-16 gap-1 relative py-1 transition-all ${
              isActive ? "scale-100" : "active:scale-90"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="nav-active-tab"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#ffb2bd] rounded-b-sm -mt-2"
              />
            )}
            <Icon
              size={22}
              className={
                isActive
                  ? "text-[#ffb2bd]"
                  : "text-[#e1bec2]"
              }
            />
            <span
              className={`font-mono text-[11px] uppercase tracking-wider ${
                isActive
                  ? "text-[#ffb2bd] font-bold"
                  : "text-[#e1bec2]"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
