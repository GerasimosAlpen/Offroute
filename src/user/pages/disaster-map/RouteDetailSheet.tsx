import { motion } from "framer-motion";
import { Navigation, Route, ShieldCheck, Timer, X } from "lucide-preact";
import type { MarkerInfo, RouteOption } from "./data";

interface RouteDetailSheetProps {
  marker: MarkerInfo;
  routes: RouteOption[] | null;
  activeRoute: "fastest" | "safest";
  onSelectRoute: (type: "fastest" | "safest") => void;
  onClose: () => void;
  onNavigate: (marker: MarkerInfo) => void;
}

/** Bottom detail card for a selected map marker: status, route options, telemetry, navigate. */
export function RouteDetailSheet({
  marker,
  routes,
  activeRoute,
  onSelectRoute,
  onClose,
  onNavigate,
}: RouteDetailSheetProps) {
  return (
    <motion.div
      initial={{ y: 120 }}
      animate={{ y: 0 }}
      exit={{ y: 120 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute bottom-20 left-0 right-0 z-40 mx-4 bg-[#262626] border border-[#444]"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#444]">
        <div className="flex items-center gap-2">
          <div
            className={
              "w-2.5 h-2.5 rounded-full " +
              (
                marker.status === "AKTIF"
                  ? "bg-[#66df75]"
                  : marker.status === "SIAP"
                  ? "bg-[#fabd00]"
                  : "bg-[#ffb2bd]"
              )
            }
          />
          <div>
            <h3 className="font-grotesk font-semibold text-base text-[#e5e2e1]">
              {marker.name}
            </h3>
            <span className="font-mono text-[9px] text-[#e1bec2] uppercase tracking-wider">
              STATUS:{" "}
              <span
                className={
                  marker.status === "AKTIF"
                    ? "text-[#66df75]"
                    : marker.status === "SIAP"
                    ? "text-[#fabd00]"
                    : "text-[#ffb2bd]"
                }
              >
                {marker.status}
              </span>
            </span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="cursor-pointer">
          <X size={14} className="text-[#666] hover:text-[#e5e2e1]" />
        </button>
      </div>

      {/* Route selector + details */}
      <div className="p-4 flex flex-col gap-3">
        {routes
          ? (
            <>
              <div className="flex gap-2">
                {routes.map((route) => {
                  const Icon = route.icon;
                  const isActive = activeRoute === route.type;
                  return (
                    <button
                      key={route.type}
                      type="button"
                      onClick={() => onSelectRoute(route.type)}
                      className={
                        "flex-1 flex items-center gap-2 px-3 py-2 border text-left transition-all cursor-pointer " +
                        (
                          isActive
                            ? "bg-[#2a2a2a] border-[#ffb2bd]"
                            : "bg-[#1c1b1b] border-[#444] hover:border-[#666]"
                        )
                      }
                    >
                      <Icon
                        size={16}
                        className={
                          isActive
                            ? route.type === "fastest"
                              ? "text-[#fabd00]"
                              : "text-[#66df75]"
                            : "text-[#e1bec2]"
                        }
                      />
                      <div className="flex flex-col">
                        <span
                          className={
                            "font-mono text-[11px] " +
                            (isActive ? "text-[#e5e2e1]" : "text-[#e1bec2]")
                          }
                        >
                          {route.label}
                        </span>
                        <span className="font-mono text-[9px] text-[#e1bec2]">
                          {route.distance} · {route.eta}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Telemetry: current route stats */}
              {(() => {
                const active = routes.find((r) => r.type === activeRoute);
                if (!active) return null;
                return (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#1c1b1b] border border-[#444] px-3 py-2 flex flex-col items-center">
                      <Route size={14} className="text-[#e1bec2] mb-1" />
                      <span className="font-mono text-[10px] text-[#66df75]">
                        {active.distance}
                      </span>
                      <span className="font-mono text-[8px] text-[#e1bec2] uppercase tracking-wider">
                        Jarak
                      </span>
                    </div>
                    <div className="bg-[#1c1b1b] border border-[#444] px-3 py-2 flex flex-col items-center">
                      <Timer size={14} className="text-[#e1bec2] mb-1" />
                      <span className="font-mono text-[10px] text-[#fabd00]">
                        {active.eta}
                      </span>
                      <span className="font-mono text-[8px] text-[#e1bec2] uppercase tracking-wider">
                        ETA
                      </span>
                    </div>
                    <div className="bg-[#1c1b1b] border border-[#444] px-3 py-2 flex flex-col items-center">
                      <ShieldCheck
                        size={14}
                        className={
                          activeRoute === "safest"
                            ? "text-[#66df75] mb-1"
                            : "text-[#fabd00] mb-1"
                        }
                      />
                      <span className="font-mono text-[10px] text-[#e1bec2]">
                        {activeRoute === "safest" ? "High" : "Medium"}
                      </span>
                      <span className="font-mono text-[8px] text-[#e1bec2] uppercase tracking-wider">
                        Keamanan
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={() => onNavigate(marker)}
                className="w-full py-3 bg-[#cb2957] text-[#ffe9eb] font-mono text-xs uppercase tracking-wider hover:bg-[#b8174a] transition-colors active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Navigation size={14} />
                Navigasi ke Lokasi
              </button>
            </>
          )
          : (
            <>
              <div className="flex items-center gap-4 font-mono text-[10px] text-[#e1bec2]">
                <span>STATUS: {marker.status}</span>
                <span>JARAK: {marker.distance}</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(marker)}
                className="w-full py-3 bg-[#cb2957] text-[#ffe9eb] font-mono text-xs uppercase tracking-wider hover:bg-[#b8174a] transition-colors active:scale-[0.98] cursor-pointer"
              >
                Navigasi ke Lokasi
              </button>
            </>
          )}
      </div>
    </motion.div>
  );
}
