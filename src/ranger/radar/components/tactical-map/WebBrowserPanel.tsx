import { useEffect, useRef, useState } from "preact/hooks";
import { ArrowLeft, ArrowRight, RotateCw, Home, Globe, Search, Film } from "lucide-preact";
import { getApiBaseUrl } from "@/lib/apiBase";
import { isTauri } from "@/lib/tauri";
import { useWindowLayout } from "../window-manager/useWindowLayout";

const isUrlLike = (q: string) => /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q);
const normalizeUrl = (q: string) => (/^https?:\/\//i.test(q) ? q : `https://${q}`);
const googleSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const proxied = (url: string) => `${getApiBaseUrl()}/proxy?url=${encodeURIComponent(url)}`;

async function invoke(cmd: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

/** Resolve address-bar input into a target URL (URL as-is, else a Google search). */
function targetOf(input: string): string | null {
  const q = input.trim();
  if (!q) return null;
  return isUrlLike(q) ? normalizeUrl(q) : googleSearch(q);
}

const BOOKMARKS: { label: string; url: string; icon?: typeof Globe }[] = [
  { label: "Google", url: "https://www.google.com" },
  { label: "YouTube", url: "https://www.youtube.com", icon: Film },
  { label: "Wikipedia", url: "https://id.wikipedia.org/wiki/Kebencanaan" },
  { label: "BMKG", url: "https://www.bmkg.go.id" },
  { label: "OSM", url: "https://www.openstreetmap.org" },
];

/**
 * "Browser" — a real browser **inside** the radar OS window (no second
 * window). On desktop it drives a native child webview (full engine, so
 * Google/YouTube work) that the frontend keeps positioned over this panel's
 * content area; it's parked off-screen whenever the panel isn't the top
 * window or is minimized. In a plain web build it falls back to the proxy
 * iframe (lightweight sites) — the native embed only exists under Tauri.
 */
export function WebBrowserPanel() {
  const [addr, setAddr] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [idx, setIdx] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  const holderRef = useRef<HTMLDivElement>(null);
  const isTop = useWindowLayout((s) => s.isTop("browser"));

  const current = idx >= 0 ? history[idx] : null;

  const go = (rawUrl: string) => {
    const url = normalizeUrl(rawUrl);
    const next = history.slice(0, idx + 1);
    next.push(url);
    setHistory(next);
    setIdx(next.length - 1);
    setAddr(url);
  };

  const submit = (input: string) => {
    const t = targetOf(input);
    if (t) go(t);
  };

  const back = () => { if (idx > 0) { setIdx(idx - 1); setAddr(history[idx - 1]); } };
  const forward = () => { if (idx < history.length - 1) { setIdx(idx + 1); setAddr(history[idx + 1]); } };
  const reload = () => setReloadKey((k) => k + 1);
  const home = () => { setIdx(-1); setAddr(""); };

  // ── Native embed (Tauri): drive the child webview to this panel ──────────
  // Navigate whenever the current page changes.
  useEffect(() => {
    if (!isTauri || !current) return;
    void invoke("browser_navigate", { url: current }).catch(() => {});
    // reloadKey re-navigates the same URL.
  }, [current, reloadKey]);

  // Keep the webview overlaid on the content area; park it off-screen when the
  // panel isn't the top window, is empty, or the tab is hidden.
  useEffect(() => {
    if (!isTauri) return;
    if (!current || !isTop) {
      void invoke("browser_hide").catch(() => {});
      return;
    }
    let raf = 0;
    let last = "";
    const loop = () => {
      const el = holderRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        // Inset a few px so the FloatingWindow's edge resize-handles stay
        // grabbable — a native webview draws above them otherwise.
        const pad = 5;
        const b = { x: r.x + pad, y: r.y + pad, width: r.width - pad * 2, height: r.height - pad * 2 };
        const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}`;
        if (b.width > 4 && b.height > 4 && key !== last) {
          last = key;
          void invoke("browser_bounds", b).catch(() => {});
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [current, isTop]);

  // Destroy the embedded webview when leaving the page / unmounting.
  useEffect(() => {
    if (!isTauri) return;
    return () => { void invoke("browser_close").catch(() => {}); };
  }, []);

  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1 p-1.5 bg-[#131313] border-b border-[#444]">
        <button type="button" onClick={back} disabled={idx <= 0} title="Back"
          className="size-6 flex items-center justify-center text-[#999] hover:text-[#e5e2e1] disabled:opacity-30">
          <ArrowLeft size={14} />
        </button>
        <button type="button" onClick={forward} disabled={idx >= history.length - 1} title="Forward"
          className="size-6 flex items-center justify-center text-[#999] hover:text-[#e5e2e1] disabled:opacity-30">
          <ArrowRight size={14} />
        </button>
        <button type="button" onClick={reload} disabled={!current} title="Reload"
          className="size-6 flex items-center justify-center text-[#999] hover:text-[#e5e2e1] disabled:opacity-30">
          <RotateCw size={13} />
        </button>
        <button type="button" onClick={home} title="Home"
          className="size-6 flex items-center justify-center text-[#999] hover:text-[#e5e2e1]">
          <Home size={13} />
        </button>
        <div className="flex-1 flex items-center gap-1.5 px-2 h-6 bg-[#1a1a1a] border border-[#444]">
          <Search size={11} className="text-[#666] shrink-0" />
          <input
            value={addr}
            onInput={(e) => setAddr((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && submit(addr)}
            placeholder="Search Google or enter address…"
            className="flex-1 bg-transparent text-[#e5e2e1] font-mono text-[11px] outline-none placeholder:text-[#555]"
            spellcheck={false}
            autocapitalize="off"
          />
        </div>
      </div>

      {/* Content */}
      {current ? (
        isTauri ? (
          // Transparent placeholder — the native webview is positioned over it.
          <div ref={holderRef} className="flex-1 min-h-0 bg-[#0d0d0d]" />
        ) : (
          <iframe
            key={`${idx}-${reloadKey}`}
            src={proxied(current)}
            title="Browser"
            className="flex-1 min-h-0 w-full bg-white"
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        )
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Globe size={40} className="text-[#5fb3b3]" />
          <div>
            <p className="font-grotesk font-bold text-[#e5e2e1] text-lg">Radar Browser</p>
            <p className="font-mono text-[10px] text-[#666] mt-1 max-w-xs">
              {isTauri
                ? "A full browser, inside the radar. Search Google or open any site."
                : "Web build: lightweight sites render inline via proxy."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-sm">
            {BOOKMARKS.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => go(b.url)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#333] bg-[#1a1a1a] text-[#c0b0b3] font-mono text-[11px] uppercase tracking-wide hover:border-[#5fb3b3] hover:text-[#5fb3b3] transition-colors"
                >
                  {Icon && <Icon size={12} />}
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
