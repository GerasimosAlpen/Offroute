import L from "leaflet";
import { type HazardKind } from "@/lib/hazards";

/** Every Leaflet `divIcon` builder used across the tactical map's markers — split out of TacticalMapCanvas.tsx so each marker component can import just what it needs. */

export const HAZARD_STYLE: Record<HazardKind, { color: string; shadow: string; diamond?: boolean }> = {
  fire: { color: "#ff0040", shadow: "rgba(255,0,64,0.5)" },
  blocked: { color: "#fabd00", shadow: "rgba(250,189,0,0.3)", diamond: true },
  medical: { color: "#66df75", shadow: "rgba(102,223,117,0.3)" },
  crash: { color: "#ff7a1a", shadow: "rgba(255,122,26,0.4)", diamond: true },
  theft: { color: "#a78bfa", shadow: "rgba(167,139,250,0.4)" },
};

export function buildHazardIcon(kind: HazardKind, label: string, minimized = false) {
  const { color, shadow, diamond } = HAZARD_STYLE[kind];
  const size = minimized ? 16 : 32;
  const dot = minimized ? 6 : 10;
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);opacity:${minimized ? 0.45 : 1};">
        <div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:#262626;border:2px solid ${color};box-shadow:0 0 7.5px ${shadow};border-radius:${diamond ? "4px" : "9999px"};transform:${diamond ? "rotate(45deg)" : "none"};">
          <div style="width:${dot}px;height:${dot}px;border-radius:9999px;background:${color};${diamond ? "transform:rotate(-45deg);" : ""}"></div>
        </div>
        ${
          minimized
            ? ""
            : `<div style="background:#131313;border:1px solid ${color};padding:2px 8px;white-space:nowrap;">
          <span style="color:${color};font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;">${label}</span>
        </div>`
        }
      </div>
    `,
    iconSize: [0, 0],
  });
}

export const SELF_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:16px;height:16px;transform:translate(-50%,-50%);">
      <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#3ddc59;opacity:0.6;"></span>
      <span style="position:absolute;inset:3px;border-radius:9999px;background:#3ddc59;border:2px solid #0a0a0a;"></span>
    </div>
  `,
  iconSize: [0, 0],
});

// The earthquake epicenter the FLARE sequence flies to and marks. Offset
// from the ranger's own position since the real BMKG quake used for the
// magnitude readout could be anywhere in Indonesia — see TODO.md for why
// the drill's position stays local while borrowing the real magnitude.
export const EPICENTER_OFFSET: [number, number] = [0.009, 0.011];

export const EPICENTER_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:40px;height:40px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;">
      <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#ff0040;opacity:0.5;"></span>
      <span class="animate-ping" style="position:absolute;inset:8px;border-radius:9999px;background:#ff0040;opacity:0.4;animation-delay:0.3s;"></span>
      <span style="position:relative;width:14px;height:14px;border-radius:9999px;background:#ff0040;border:2px solid #fff;"></span>
    </div>
  `,
  iconSize: [0, 0],
});

export const VICTIM_ICON = L.divIcon({
  className: "",
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#fabd00;opacity:0.55;"></span>
        <span style="position:relative;width:12px;height:12px;border-radius:9999px;background:#fabd00;border:2px solid #131313;"></span>
      </div>
      <div style="background:#131313;border:1px solid #fabd00;padding:2px 8px;white-space:nowrap;">
        <span style="color:#fabd00;font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;">Korban Terdeteksi</span>
      </div>
    </div>
  `,
  iconSize: [0, 0],
});

// Real SOS pings from `/sos` (real GPS, real person) — visually distinct
// from VICTIM_ICON above, which is FLARE's simulated drill detection, not a
// genuine report. Conflating the two on the map would be dishonest.
export function buildSosIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
        <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
          <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#ff0040;opacity:0.6;"></span>
          <span style="position:relative;width:13px;height:13px;border-radius:9999px;background:#ff0040;border:2px solid #fff;"></span>
        </div>
        <div style="background:#131313;border:1px solid #ff0040;padding:2px 8px;white-space:nowrap;">
          <span style="color:#ff0040;font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;font-weight:bold;">SOS — ${label}</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

export function buildRangerIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `
      <div class="mesh-pop" style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-50%);">
        <div style="position:relative;width:22px;height:22px;">
          <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:#5fb3b3;opacity:0.6;"></span>
          <span style="position:absolute;inset:5px;border-radius:9999px;background:#5fb3b3;border:2px solid #0a0a0a;"></span>
        </div>
        <div style="background:#131313;border:1px solid #5fb3b3;padding:1px 6px;white-space:nowrap;">
          <span style="color:#5fb3b3;font-family:'JetBrains Mono Variable',monospace;font-size:10px;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });
}

export const MESSAGE_PIN_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:20px;height:20px;transform:translate(-50%,-100%);display:flex;align-items:center;justify-content:center;">
      <div style="width:20px;height:20px;border-radius:9999px 9999px 9999px 2px;background:#e5e2e1;border:2px solid #131313;transform:rotate(45deg);"></div>
    </div>
  `,
  iconSize: [0, 0],
});

export const EVAC_POINT_ICON = L.divIcon({
  className: "",
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#131313;border:2px solid #66df75;border-radius:9999px;box-shadow:0 0 8px rgba(102,223,117,0.5);">
        <div style="width:12px;height:12px;border-radius:9999px;background:#66df75;"></div>
      </div>
      <div style="background:#131313;border:1px solid #66df75;padding:2px 8px;white-space:nowrap;">
        <span style="color:#66df75;font-family:'JetBrains Mono Variable',monospace;font-size:11px;text-transform:uppercase;">Titik Evakuasi Aman</span>
      </div>
    </div>
  `,
  iconSize: [0, 0],
});
