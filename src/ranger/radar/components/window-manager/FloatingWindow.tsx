import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Square, Copy, type LucideIcon } from "lucide-preact";
import { useWindowLayout, type WindowRect } from "./useWindowLayout";
import { computeSnapZone, clamp, MIN_W_FRAC, MIN_H_FRAC } from "./snapZones";

interface FloatingWindowProps {
  id: string;
  title: string;
  defaultRect: WindowRect;
  icon?: LucideIcon;
  children: ComponentChildren;
}

const MAX_RECT: WindowRect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * A draggable, resizable, snapping, minimizable, maximizable window — radar's
 * OS window surface. Now with a real OS title bar: app icon + title on the
 * left, minimize + maximize/restore controls on the right, double-click to
 * maximize, and an accent border + shadow on the focused window.
 */
export function FloatingWindow({ id, title, defaultRect, icon: Icon, children }: FloatingWindowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rect = useWindowLayout((s) => s.rects[id]) ?? defaultRect;
  const zIndex = useWindowLayout((s) => s.zIndexOf(id));
  const minimized = useWindowLayout((s) => s.minimized[id] ?? false);
  const maximized = useWindowLayout((s) => s.maximized[id] ?? false);
  const active = useWindowLayout((s) => s.isTop(id));
  const setRect = useWindowLayout((s) => s.setRect);
  const focus = useWindowLayout((s) => s.focus);
  const minimize = useWindowLayout((s) => s.minimize);
  const toggleMaximize = useWindowLayout((s) => s.toggleMaximize);
  const unmaximize = useWindowLayout((s) => s.unmaximize);
  const setDragSnapZone = useWindowLayout((s) => s.setDragSnapZone);

  const dragRef = useRef<{ mouseX: number; mouseY: number; rectX: number; rectY: number } | null>(null);
  const resizeRef = useRef<{ mouseX: number; mouseY: number; start: WindowRect; dir: string } | null>(null);
  // While dragging/resizing, position/size must track the pointer with zero
  // lag — so the smooth CSS transition (used for maximize/tile/snap) is
  // switched off during direct manipulation.
  const [interacting, setInteracting] = useState(false);

  // Suppress text selection across the whole app while a window is being
  // dragged or resized — otherwise the drag highlights map labels, panel
  // text, etc. Restored the instant the pointer is released.
  useEffect(() => {
    if (!interacting) return;
    const body = document.body.style;
    const prev = body.userSelect;
    body.userSelect = "none";
    (body as unknown as { webkitUserSelect: string }).webkitUserSelect = "none";
    return () => {
      body.userSelect = prev;
      (body as unknown as { webkitUserSelect: string }).webkitUserSelect = prev;
    };
  }, [interacting]);

  const getContainerRect = (): DOMRect | null => {
    const container = rootRef.current?.offsetParent as HTMLElement | null;
    return container ? container.getBoundingClientRect() : null;
  };

  const onTitleBarPointerDown = (e: PointerEvent) => {
    focus(id);
    // Dragging a maximized window restores it first (Windows behavior).
    if (maximized) unmaximize(id);
    setInteracting(true);
    dragRef.current = { mouseX: e.clientX, mouseY: e.clientY, rectX: rect.x, rectY: rect.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onTitleBarPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    const containerRect = getContainerRect();
    if (!drag || !containerRect) return;

    const dxFrac = (e.clientX - drag.mouseX) / containerRect.width;
    const dyFrac = (e.clientY - drag.mouseY) / containerRect.height;
    const nextX = clamp(drag.rectX + dxFrac, 0, Math.max(0, 1 - rect.w));
    const nextY = clamp(drag.rectY + dyFrac, 0, Math.max(0, 1 - rect.h));
    setRect(id, { ...rect, x: nextX, y: nextY });
    setDragSnapZone(computeSnapZone(e.clientX, e.clientY, containerRect));
  };

  const onTitleBarPointerUp = (e: PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setInteracting(false);
    const zone = useWindowLayout.getState().dragSnapZone;
    if (zone) setRect(id, zone);
    setDragSnapZone(null);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onResizePointerDown = (dir: string) => (e: PointerEvent) => {
    e.stopPropagation();
    focus(id);
    setInteracting(true);
    resizeRef.current = { mouseX: e.clientX, mouseY: e.clientY, start: { ...rect }, dir };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: PointerEvent) => {
    const resize = resizeRef.current;
    const containerRect = getContainerRect();
    if (!resize || !containerRect) return;

    const dxFrac = (e.clientX - resize.mouseX) / containerRect.width;
    const dyFrac = (e.clientY - resize.mouseY) / containerRect.height;
    const { x, y, w, h } = resize.start;
    let nextX = x;
    let nextY = y;
    let nextW = w;
    let nextH = h;

    if (resize.dir.includes("e")) nextW = clamp(w + dxFrac, MIN_W_FRAC, 1 - x);
    if (resize.dir.includes("w")) {
      nextW = clamp(w - dxFrac, MIN_W_FRAC, x + w);
      nextX = x + w - nextW;
    }
    if (resize.dir.includes("s")) nextH = clamp(h + dyFrac, MIN_H_FRAC, 1 - y);
    if (resize.dir.includes("n")) {
      nextH = clamp(h - dyFrac, MIN_H_FRAC, y + h);
      nextY = y + h - nextH;
    }

    setRect(id, { x: nextX, y: nextY, w: nextW, h: nextH });
  };

  const onResizePointerUp = (e: PointerEvent) => {
    resizeRef.current = null;
    setInteracting(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const HANDLES: Array<{ dir: string; className: string; cursor: string }> = [
    { dir: "n", className: "top-0 left-2 right-2 h-1.5", cursor: "ns-resize" },
    { dir: "s", className: "bottom-0 left-2 right-2 h-1.5", cursor: "ns-resize" },
    { dir: "e", className: "top-2 bottom-2 right-0 w-1.5", cursor: "ew-resize" },
    { dir: "w", className: "top-2 bottom-2 left-0 w-1.5", cursor: "ew-resize" },
    { dir: "nw", className: "top-0 left-0 size-2.5", cursor: "nwse-resize" },
    { dir: "ne", className: "top-0 right-0 size-2.5", cursor: "nesw-resize" },
    { dir: "sw", className: "bottom-0 left-0 size-2.5", cursor: "nesw-resize" },
    { dir: "se", className: "bottom-0 right-0 size-2.5", cursor: "nwse-resize" },
  ];

  const r = maximized ? MAX_RECT : rect;
  const ctrlBtn =
    "size-4 flex items-center justify-center text-[#999] hover:text-[#e5e2e1] transition-colors";

  // Smooth size/position tween for maximize/restore/snap/tile/cascade — but
  // instant while the pointer is dragging or resizing.
  const posTransition = interacting
    ? "none"
    : "left .26s cubic-bezier(.2,.8,.2,1), top .26s cubic-bezier(.2,.8,.2,1), width .26s cubic-bezier(.2,.8,.2,1), height .26s cubic-bezier(.2,.8,.2,1)";

  return (
    <AnimatePresence>
      {!minimized && (
        <motion.div
          key={id}
          ref={rootRef}
          onPointerDownCapture={() => focus(id)}
          // Open/restore pop-in; minimize/close shrink-and-fade toward the taskbar.
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 14, transition: { duration: 0.13, ease: "easeIn" } }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
          style={{
            position: "absolute",
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.w * 100}%`,
            height: `${r.h * 100}%`,
            zIndex,
            boxShadow: active ? "0 8px 30px rgba(0,0,0,0.55)" : "0 2px 10px rgba(0,0,0,0.35)",
            transition: posTransition,
          }}
          className="flex flex-col"
        >
      {/* OS title bar */}
      <div
        onPointerDown={onTitleBarPointerDown}
        onPointerMove={onTitleBarPointerMove}
        onPointerUp={onTitleBarPointerUp}
        onDblClick={() => toggleMaximize(id)}
        role="button"
        aria-label={`Jendela ${title}`}
        className={`shrink-0 h-6 flex items-center gap-1.5 pl-2 pr-1 border border-b-0 select-none touch-none cursor-grab active:cursor-grabbing ${
          active ? "bg-[#151515] border-[#5fb3b3]/60" : "bg-[#0a0a0a] border-[#333]"
        }`}
      >
        {Icon && <Icon size={11} className={active ? "text-[#5fb3b3]" : "text-[#666]"} />}
        <span className={`font-mono text-[10px] uppercase tracking-wider truncate ${active ? "text-[#e5e2e1]" : "text-[#888]"}`}>
          {title}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); minimize(id); }}
            title="Kecilkan"
            className={ctrlBtn}
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); toggleMaximize(id); }}
            title={maximized ? "Pulihkan" : "Maksimalkan"}
            className={ctrlBtn}
          >
            {maximized ? <Copy size={10} /> : <Square size={10} />}
          </button>
        </div>
      </div>

      <div className={`flex-1 min-h-0 flex flex-col border-x ${active ? "border-[#5fb3b3]/40" : "border-[#333]"}`}>
        {children}
      </div>

          {/* Resize grips — disabled while maximized, like a real OS. */}
          {!maximized &&
            HANDLES.map((hnd) => (
              <div
                key={hnd.dir}
                onPointerDown={onResizePointerDown(hnd.dir)}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                className={`absolute ${hnd.className} touch-none z-10`}
                style={{ cursor: hnd.cursor }}
              />
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
