import L from "leaflet";

export function buildUserIcon(name: string, color: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
        <div style="position:relative;width:14px;height:14px;">
          <span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.35;animation:pulse 2s infinite;"></span>
          <span style="position:absolute;inset:2px;border-radius:9999px;background:${color};border:2px solid #0a0a0a;"></span>
        </div>
        <div style="background:#131313;border:1px solid #444;padding:2px 6px;white-space:nowrap;">
          <span style="color:#e5e2e1;font-family:'JetBrains Mono Variable',monospace;font-size:9px;">${name}</span>
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
    </div>
  `,
  iconSize: [0, 0],
});
