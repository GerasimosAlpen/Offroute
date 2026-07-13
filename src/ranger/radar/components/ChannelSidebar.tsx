import { useEffect, useRef, useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { Radar } from "lucide-preact";
import { NavigationTabs, FooterTabs } from "./NavigationTabs";
import { SidebarTooltip } from "./SidebarTooltip";
import { FlareButton } from "./FlareButton";
import { useDeviceLocation } from "@/store/location";
import { getPersisted, setPersisted } from "@/lib/persist";

const MIN_WIDTH = 124;
const MAX_WIDTH = 340;
const DEFAULT_WIDTH = 288;
const COLLAPSED_WIDTH = 72;
const COLLAPSE_THRESHOLD = 160;
const WIDTH_KEY = "ranger:sidebar-width";
const COLLAPSED_KEY = "ranger:sidebar-collapsed";

export function ChannelSidebar() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [markHovered, setMarkHovered] = useState(false);
  const draggingRef = useRef(false);
  const liveWidthRef = useRef(width);
  const location = useDeviceLocation();

  // Persisted values load async (real disk I/O in Tauri) — start from the
  // defaults above and correct once loaded, instead of blocking first paint.
  useEffect(() => {
    getPersisted<number>(WIDTH_KEY).then((saved) => {
      if (saved !== null && saved >= MIN_WIDTH && saved <= MAX_WIDTH) {
        setWidth(saved);
        liveWidthRef.current = saved;
      }
    });
    getPersisted<boolean>(COLLAPSED_KEY).then((saved) => {
      if (saved !== null) setCollapsed(saved);
    });
  }, []);

  const setCollapsedPersisted = (next: boolean) => {
    setCollapsed(next);
    void setPersisted(COLLAPSED_KEY, next);
  };

  const onHandlePointerDown = (e: PointerEvent) => {
    draggingRef.current = true;
    setIsDragging(true);
    liveWidthRef.current = collapsed ? COLLAPSED_WIDTH : width;
    document.body.style.userSelect = "none";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const next = Math.min(MAX_WIDTH, e.clientX);
    liveWidthRef.current = next;

    if (collapsed) {
      // Only break out of the rail once dragged meaningfully past it.
      if (next > COLLAPSED_WIDTH + 40) {
        setCollapsedPersisted(false);
        setWidth(Math.max(MIN_WIDTH, next));
      }
      return;
    }

    setWidth(Math.max(0, next));
  };

  const onHandlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    document.body.style.userSelect = "";

    if (collapsed) return;

    if (liveWidthRef.current < COLLAPSE_THRESHOLD) {
      setCollapsedPersisted(true);
      return;
    }

    const clamped = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, liveWidthRef.current),
    );
    setWidth(clamped);
    void setPersisted(WIDTH_KEY, clamped);
  };

  const onHandleDoubleClick = () => setCollapsedPersisted(!collapsed);

  const asideWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <motion.aside
      initial={{ x: -32, opacity: 0 }}
      animate={{ x: 0, opacity: 1, width: asideWidth }}
      transition={
        isDragging
          ? {
              type: "spring",
              stiffness: 260,
              damping: 28,
              width: { duration: 0 },
            }
          : { type: "spring", stiffness: 260, damping: 28 }
      }
      className="relative h-full flex flex-col shrink-0 bg-[#262626] border-r-2 border-[#444] items-start justify-between font-grotesk select-none overflow-hidden"
    >
      <header
        className={`border-b-2 w-full border-[#444] overflow-hidden ${collapsed ? "p-3" : "p-5"}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.button
              key="mark"
              type="button"
              onClick={() => setCollapsedPersisted(false)}
              onMouseEnter={() => setMarkHovered(true)}
              onMouseLeave={() => setMarkHovered(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center w-full text-[#FF0040]"
              aria-label="Expand sidebar"
            >
              <Radar size={26} strokeWidth={2.2} />
              <SidebarTooltip show={markHovered} label="Expand sidebar" />
            </motion.button>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <h1 className="text-[#FF0040] font-grotesk font-bold text-3xl tracking-[-0.6px]">
                RANGER COMMAND
              </h1>

              <p
                className={`font-mono font-thin text-[14px] tracking-[1.4px] uppercase ${
                  location.status === "ready" || location.status === "cached"
                    ? "text-[#E1BEC2]"
                    : "text-[#8a8a8a]"
                }`}
              >
                {location.label}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <NavigationTabs collapsed={collapsed} />
      <FlareButton collapsed={collapsed} />
      <FooterTabs collapsed={collapsed} />

      <div
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        onDblClick={onHandleDoubleClick}
        className="absolute top-0 -right-1 h-full w-2 cursor-col-resize touch-none z-10 group"
      >
        <div className="h-full w-px mx-auto bg-transparent group-hover:bg-[#FF0040]/60 group-active:bg-[#FF0040]" />
      </div>
    </motion.aside>
  );
}
