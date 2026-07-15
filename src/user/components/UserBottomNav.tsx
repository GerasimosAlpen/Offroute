import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { LayoutDashboard, AlertTriangle, Map, Radio } from "lucide-preact";

const TABS = [
  { href: "/user/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/user/report", label: "Lapor", icon: AlertTriangle },
  { href: "/user/map", label: "Map", icon: Map },
  { href: "/user/flare", label: "Flare", icon: Radio },
] as const;

/**
 * Mobile bottom navigation for the citizen user app — animated active tab
 * indicator (layoutId spring), tactile feedback on press, styled with the
 * same tactical palette as the rest of the app.
 */
export function UserBottomNav() {
  const [location, navigate] = useLocation();

  const activeTab = TABS.find((t) =>
    t.href === "/user/"
      ? location === "/user/" || location === "/user"
      : location.startsWith(t.href),
  );

  return (
    <motion.nav
      initial={{ y: 48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.3 }}
      className="fixed bottom-0 left-0 w-full flex justify-around items-center px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#131313] border-t-2 border-[#444] z-50"
    >
      {TABS.map((tab) => {
        const isActive = activeTab?.href === tab.href;
        const Icon = tab.icon;
        return (
          <button
            key={tab.href}
            onClick={() => navigate(tab.href)}
            className={`flex flex-col items-center justify-center w-16 gap-0.5 relative py-1 transition-all ${
              isActive ? "scale-100" : "active:scale-90"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="user-nav-active-tab"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#ffb2bd] rounded-b-sm -mt-2"
              />
            )}
            <Icon
              size={20}
              strokeWidth={isActive ? 2.4 : 1.8}
              className={
                isActive
                  ? "text-[#ffb2bd]"
                  : "text-[#e1bec2]"
              }
            />
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${
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
    </motion.nav>
  );
}
