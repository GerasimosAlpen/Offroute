import L from "leaflet";
import { DANGER_COLORS, type EventMarker } from "./types";

const TYPE_ICONS_SVG: Record<string, string> = {
  KEBAKARAN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0040"><path d="M12 2C10 6 8 8 8 11a4 4 0 008 0c0-3-2-5-4-9z"/><path d="M10 18a2 2 0 104 0" fill="#ff6680"/></svg>`,
  BENCANA: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fabd00" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  MEDIS: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb2bd" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12h6M12 9v6"/></svg>`,
  KEAMANAN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fabd00" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
};

// Markers sit inside the same wrapper that gets CSS-rotated to match device
// heading (see the `--map-heading` var set in PetaTaktis) — every marker
// counter-rotates by that same var so labels/icons stay upright and legible
// instead of spinning along with the base map. A no-op (0deg) when heading
// isn't available, so nothing changes for the plain north-up case.
export function buildEventIcon(event: EventMarker) {
  const c = DANGER_COLORS[event.danger];
  const svg = TYPE_ICONS_SVG[event.type];
  const pulse = event.danger === "KRITIS"
    ? `<span style="position:absolute;inset:0;background:${c.border};opacity:0.2;animation:pulse 1.8s infinite;"></span>`
    : "";

  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;transform:translate(-50%,-100%) rotate(var(--map-heading, 0deg));">
        <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:2px solid ${c.border};box-shadow:${c.glow};">
          ${pulse}
          ${svg}
        </div>
        <div style="background:${c.border};color:#fff;font-family:'JetBrains Mono Variable',monospace;font-size:9px;font-weight:bold;padding:2px 7px;letter-spacing:0.08em;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;">
          ${event.name}
        </div>
        <div style="background:#131313;color:${c.text};font-family:'JetBrains Mono Variable',monospace;font-size:8px;padding:1px 5px;border:1px solid ${c.border};white-space:nowrap;">
          ${event.danger} · ${event.distance}
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

export const SELF_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:16px;height:16px;transform:translate(-50%,-50%);">
      <span style="position:absolute;inset:0;border-radius:9999px;background:#3ddc59;opacity:0.6;animation:pulse 2s infinite;"></span>
      <span style="position:absolute;inset:3px;border-radius:9999px;background:#3ddc59;border:2px solid #0a0a0a;"></span>
      <span style="position:absolute;left:50%;top:-13px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid #3ddc59;transform:translateX(-50%);opacity:var(--heading-available, 0);filter:drop-shadow(0 0 3px rgba(61,220,89,0.7));"></span>
    </div>
  `,
  iconSize: [0, 0],
});

// The fixed point a route search began from — distinct from the live SELF_ICON
// dot, which keeps moving with GPS. Lets the crew see start vs. current
// position vs. destination all at once instead of just one wandering dot.
export const START_ICON = L.divIcon({
  className: "",
  html: `
    <div style="transform:translate(-50%,-100%) rotate(var(--map-heading, 0deg));">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8888ff" stroke-width="2.2" style="filter:drop-shadow(0 0 4px rgba(136,136,255,0.6));">
        <path d="M5 21V4a1 1 0 0 1 1-1h11.5a.5.5 0 0 1 .4.8L14 9l3.9 5.2a.5.5 0 0 1-.4.8H6" />
      </svg>
    </div>
  `,
  iconSize: [0, 0],
});
