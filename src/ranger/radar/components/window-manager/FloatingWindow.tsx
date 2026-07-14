import { useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { useWindowLayout, type WindowRect } from "./useWindowLayout";
import { computeSnapZone, clamp, MIN_W_FRAC, MIN_H_FRAC } from "./snapZones";

interface FloatingWindowProps {
  id: string;
  title: string;
  defaultRect: WindowRect;
  children: ComponentChildren;
}

/**
 * A draggable, resizable, edge/corner-snapping panel — radar's "OS window
 * management" surface. Each panel already renders its own header (icon +
 * title), so the outer frame added here is a plain grip strip, not a second
 * title bar — a real OS window frame doesn't repeat the app's own title
 * either. `title` is kept for the drag handle's accessible name only.
 */
export function FloatingWindow({ id, title, defaultRect, children }: FloatingWindowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rect = useWindowLayout((s) => s.rects[id]) ?? defaultRect;
  const zIndex = useWindowLayout((s) => s.zIndexOf(id));
  const setRect = useWindowLayout((s) => s.setRect);
  const focus = useWindowLayout((s) => s.focus);
  const setDragSnapZone = useWindowLayout((s) => s.setDragSnapZone);

  const dragRef = useRef<{ mouseX: number; mouseY: number; rectX: number; rectY: number } | null>(null);
  const resizeRef = useRef<{ mouseX: number; mouseY: number; rectW: number; rectH: number } | null>(null);

  const getContainerRect = (): DOMRect | null => {
    const container = rootRef.current?.offsetParent as HTMLElement | null;
    return container ? container.getBoundingClientRect() : null;
  };

  const onTitleBarPointerDown = (e: PointerEvent) => {
    focus(id);
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
    const zone = useWindowLayout.getState().dragSnapZone;
    if (zone) setRect(id, zone);
    setDragSnapZone(null);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onResizePointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    focus(id);
    resizeRef.current = { mouseX: e.clientX, mouseY: e.clientY, rectW: rect.w, rectH: rect.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: PointerEvent) => {
    const resize = resizeRef.current;
    const containerRect = getContainerRect();
    if (!resize || !containerRect) return;

    const dwFrac = (e.clientX - resize.mouseX) / containerRect.width;
    const dhFrac = (e.clientY - resize.mouseY) / containerRect.height;
    const nextW = clamp(resize.rectW + dwFrac, MIN_W_FRAC, Math.max(MIN_W_FRAC, 1 - rect.x));
    const nextH = clamp(resize.rectH + dhFrac, MIN_H_FRAC, Math.max(MIN_H_FRAC, 1 - rect.y));
    setRect(id, { ...rect, w: nextW, h: nextH });
  };

  const onResizePointerUp = (e: PointerEvent) => {
    resizeRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={rootRef}
      onPointerDownCapture={() => focus(id)}
      style={{
        position: "absolute",
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        zIndex,
      }}
      className="flex flex-col"
    >
      <div
        onPointerDown={onTitleBarPointerDown}
        onPointerMove={onTitleBarPointerMove}
        onPointerUp={onTitleBarPointerUp}
        role="button"
        aria-label={`Pindahkan jendela ${title}`}
        title={`Seret untuk memindahkan — ${title}`}
        className="shrink-0 h-2.5 flex items-center justify-center gap-0.5 bg-[#0a0a0a] border border-b-0 border-[#444] cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <span className="w-6 h-[3px] rounded-full bg-[#3a3a3a]" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col">{children}</div>

      <div
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        className="absolute bottom-0 right-0 size-3.5 cursor-nwse-resize touch-none"
        style={{
          background:
            "linear-gradient(135deg, transparent 0 50%, #666 50% 60%, transparent 60% 70%, #666 70% 80%, transparent 80%)",
        }}
      />
    </div>
  );
}
