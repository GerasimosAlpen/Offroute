import { useRef, useState } from "preact/hooks";
import { motion, AnimatePresence } from "framer-motion";
import { Radar } from "lucide-preact";
import { NavigationTabs, FooterTabs } from "./NavigationTabs";

const MIN_WIDTH = 224;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 288;
const COLLAPSED_WIDTH = 72;
const COLLAPSE_THRESHOLD = 160;
const WIDTH_KEY = "ranger:sidebar-width";
const COLLAPSED_KEY = "ranger:sidebar-collapsed";

function readStoredWidth() {
  const saved = Number(localStorage.getItem(WIDTH_KEY));
  return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
}

export function ChannelSidebar() {
  const [width, setWidth] = useState(readStoredWidth);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1",
  );
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const liveWidthRef = useRef(width);

  const setCollapsedPersisted = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  };

  const onHandlePointerDown = (e: PointerEvent) => {
    draggingRef.current = true;
    setIsDragging(true);
    liveWidthRef.current = collapsed ? COLLAPSED_WIDTH : width;
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

    if (collapsed) return;

    if (liveWidthRef.current < COLLAPSE_THRESHOLD) {
      setCollapsedPersisted(true);
      return;
    }

    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, liveWidthRef.current));
    setWidth(clamped);
    localStorage.setItem(WIDTH_KEY, String(clamped));
  };

  const onHandleDoubleClick = () => setCollapsedPersisted(!collapsed);

  const asideWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <motion.aside
      initial={{ x: -32, opacity: 0 }}
      animate={{ x: 0, opacity: 1, width: asideWidth }}
      transition={
        isDragging
          ? { type: "spring", stiffness: 260, damping: 28, width: { duration: 0 } }
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center w-full text-[#FF0040]"
              aria-label="Expand sidebar"
            >
              <Radar size={26} strokeWidth={2.2} />
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

              {/* TODO: change into the ranger actual location */}
              <p className="font-mono font-thin text-[14px] tracking-[1.4px] text-[#E1BEC2]">
                sector-07
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <NavigationTabs collapsed={collapsed} />
      <FooterTabs collapsed={collapsed} />

      <div
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onDblClick={onHandleDoubleClick}
        className="absolute top-0 -right-1 h-full w-2 cursor-col-resize touch-none z-10 group"
      >
        <div className="h-full w-px mx-auto bg-transparent group-hover:bg-[#FF0040]/60 group-active:bg-[#FF0040]" />
      </div>
    </motion.aside>
  );
}
