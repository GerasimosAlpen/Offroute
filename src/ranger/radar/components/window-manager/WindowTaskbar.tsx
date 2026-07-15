import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, LayoutGrid, Rows, RotateCcw, Activity, TerminalSquare, type LucideIcon } from "lucide-preact";
import { useWindowLayout } from "./useWindowLayout";
import { SystemTray } from "./SystemTray";

export interface TaskbarWindow {
  id: string;
  title: string;
  icon: LucideIcon;
}

/**
 * The radar OS taskbar: a Start/launcher menu on the left, running-window
 * buttons in the middle, and a live system tray (clock + status) on the
 * right. Minimize a window and it collapses here; click to restore. The
 * launcher also arranges windows (cascade/tile) and jumps to full-screen
 * pages, so the whole radar reads and reacts like a desktop OS.
 */
export function WindowTaskbar({ windows }: { windows: TaskbarWindow[] }) {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const minimized = useWindowLayout((s) => s.minimized);
  const restore = useWindowLayout((s) => s.restore);
  const focus = useWindowLayout((s) => s.focus);
  const minimize = useWindowLayout((s) => s.minimize);
  const cascade = useWindowLayout((s) => s.cascade);
  const tile = useWindowLayout((s) => s.tile);
  const resetLayout = useWindowLayout((s) => s.resetLayout);

  const ids = windows.map((w) => w.id);
  const openApp = (id: string) => {
    restore(id);
    setMenuOpen(false);
  };

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-1.5 py-1 bg-[#0a0a0a] border border-[#333] relative">
      {/* Start / launcher */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title="Menu"
          className={`flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[10px] uppercase tracking-wide transition-colors ${
            menuOpen ? "border-[#FF0040] text-[#FF0040] bg-[#FF0040]/10" : "border-[#333] text-[#e5e2e1] hover:border-[#FF0040]/60"
          }`}
        >
          <Radar size={13} className="text-[#FF0040]" /> Menu
        </button>

        <AnimatePresence>
          {menuOpen && (
            <>
              {/* click-away */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                style={{ transformOrigin: "bottom left" }}
                className="absolute bottom-full left-0 mb-2 w-60 bg-[#151515] border border-[#444] shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-50 flex flex-col"
              >
                <div className="px-3 py-2 border-b border-[#333]">
                  <span className="font-grotesk font-bold text-[#FF0040] text-sm tracking-wide">RANGER OS</span>
                </div>

                <MenuSection label="Aplikasi">
                  {windows.map((w) => (
                    <MenuItem key={w.id} icon={w.icon} label={w.title} onClick={() => openApp(w.id)} />
                  ))}
                </MenuSection>

                <MenuSection label="Halaman">
                  <MenuItem icon={Activity} label="Monitor Sistem" onClick={() => { navigate("/ranger/radar/monitor"); setMenuOpen(false); }} />
                  <MenuItem icon={TerminalSquare} label="Terminal" onClick={() => { navigate("/ranger/radar/terminal"); setMenuOpen(false); }} />
                </MenuSection>

                <MenuSection label="Tata Letak">
                  <MenuItem icon={LayoutGrid} label="Ubin (Tile)" onClick={() => { tile(ids); setMenuOpen(false); }} />
                  <MenuItem icon={Rows} label="Bertumpuk (Cascade)" onClick={() => { cascade(ids); setMenuOpen(false); }} />
                  <MenuItem icon={RotateCcw} label="Reset Tata Letak" onClick={() => { resetLayout(); setMenuOpen(false); }} />
                </MenuSection>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="w-px h-5 bg-[#333] shrink-0" />

      {/* Running windows */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto">
        {windows.map((w) => {
          const isMin = minimized[w.id] ?? false;
          const Icon = w.icon;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => (isMin ? restore(w.id) : minimize(w.id))}
              title={isMin ? `Buka ${w.title}` : `Kecilkan ${w.title}`}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[10px] uppercase tracking-wide transition-colors ${
                isMin
                  ? "border-[#333] text-[#666] hover:border-[#555] hover:text-[#999]"
                  : "border-[#5fb3b3]/50 text-[#5fb3b3] bg-[#5fb3b3]/5"
              }`}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{w.title}</span>
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-[#333] shrink-0" />
      <SystemTray />
    </div>
  );
}

function MenuSection({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div className="py-1 border-b border-[#262626] last:border-b-0">
      <span className="block px-3 py-0.5 font-mono text-[8px] text-[#555] uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] text-[#c0b0b3] hover:bg-[#5fb3b3]/10 hover:text-[#e5e2e1] transition-colors"
    >
      <Icon size={12} className="text-[#5fb3b3] shrink-0" /> {label}
    </button>
  );
}
