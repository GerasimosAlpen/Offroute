import { useRef, useState } from "preact/hooks";
import { ArrowLeft, ArrowRight, RotateCw, Home, Globe, Search, AppWindow, Film } from "lucide-preact";
import { getApiBaseUrl } from "@/lib/apiBase";
import { isTauri } from "@/lib/tauri";

interface Entry {
  src: string;
  display: string;
}

const isUrlLike = (q: string) => /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q);
const normalizeUrl = (q: string) => (/^https?:\/\//i.test(q) ? q : `https://${q}`);
const googleSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** Proxy render (inside the iframe) — works for lightweight, framable sites. */
const proxied = (url: string) => `${getApiBaseUrl()}/proxy?url=${encodeURIComponent(url)}`;

/**
 * Open a URL in a REAL in-app browser window (full webview engine) — the only
 * way to reach Google, YouTube and other JS-heavy/anti-framing sites that a
 * proxy can't render. It's Offroute's own window, not the system browser.
 */
async function openInAppWindow(url: string) {
  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_browser_window", { url });
      return;
    } catch {
      /* fall through to a normal tab */
    }
  }
  window.open(url, "_blank", "noopener");
}

// Inline bookmarks render in-frame via the proxy; window bookmarks open the
// real in-app browser (Google/YouTube can't be framed).
const BOOKMARKS: { label: string; url: string; mode: "inline" | "window"; icon?: typeof Globe }[] = [
  { label: "Google", url: "https://www.google.com", mode: "window" },
  { label: "YouTube", url: "https://www.youtube.com", mode: "window", icon: Film },
  { label: "Wikipedia", url: "https://id.wikipedia.org/wiki/Kebencanaan", mode: "inline" },
  { label: "BMKG", url: "https://www.bmkg.go.id", mode: "inline" },
  { label: "OSM", url: "https://www.openstreetmap.org", mode: "inline" },
];

/**
 * "Browser" — a browser inside the radar OS. Lightweight sites render inline
 * via the backend proxy; Google/YouTube and anything JS-heavy open in a real
 * in-app browser window (a full engine). Search goes to Google in that real
 * window, so the operator can actually reach the whole web from the radar.
 */
export function WebBrowserPanel() {
  const [addr, setAddr] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [idx, setIdx] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const current = idx >= 0 ? history[idx] : null;

  /** Load a real URL inline (proxied) in the iframe. */
  const openInline = (rawUrl: string) => {
    const url = normalizeUrl(rawUrl);
    const entry: Entry = { src: proxied(url), display: url };
    const next = history.slice(0, idx + 1);
    next.push(entry);
    setHistory(next);
    setIdx(next.length - 1);
    setAddr(url);
  };

  /** Address-bar submit: a URL renders inline; anything else is a Google search in the real window. */
  const submit = (input: string) => {
    const q = input.trim();
    if (!q) return;
    if (isUrlLike(q)) openInline(q);
    else void openInAppWindow(googleSearch(q));
  };

  const back = () => { if (idx > 0) { setIdx(idx - 1); setAddr(history[idx - 1].display); } };
  const forward = () => { if (idx < history.length - 1) { setIdx(idx + 1); setAddr(history[idx + 1].display); } };
  const reload = () => setReloadKey((k) => k + 1);
  const home = () => { setIdx(-1); setAddr(""); };

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
        <button
          type="button"
          onClick={() => current && openInAppWindow(current.display)}
          disabled={!current}
          title="Open in app browser window (full engine — for Google/YouTube/etc.)"
          className="size-6 flex items-center justify-center text-[#999] hover:text-[#5fb3b3] disabled:opacity-30">
          <AppWindow size={13} />
        </button>
      </div>

      {/* Content */}
      {current ? (
        <iframe
          ref={iframeRef}
          key={`${idx}-${reloadKey}`}
          src={current.src}
          title="Browser"
          className="flex-1 min-h-0 w-full bg-white"
          sandbox="allow-scripts allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Globe size={40} className="text-[#5fb3b3]" />
          <div>
            <p className="font-grotesk font-bold text-[#e5e2e1] text-lg">Radar Browser</p>
            <p className="font-mono text-[10px] text-[#666] mt-1 max-w-xs">
              Search opens Google in a full in-app browser window. Lightweight sites render inline here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-sm">
            {BOOKMARKS.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => (b.mode === "window" ? openInAppWindow(b.url) : openInline(b.url))}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#333] bg-[#1a1a1a] text-[#c0b0b3] font-mono text-[11px] uppercase tracking-wide hover:border-[#5fb3b3] hover:text-[#5fb3b3] transition-colors"
                >
                  {Icon && <Icon size={12} />}
                  {b.label}
                  {b.mode === "window" && <AppWindow size={9} className="text-[#555]" />}
                </button>
              );
            })}
          </div>
          <p className="font-mono text-[9px] text-[#555] max-w-xs">
            <AppWindow size={9} className="inline" /> = opens in a real in-app browser window (Google, YouTube, and JS-heavy sites can't render inline).
          </p>
        </div>
      )}
    </div>
  );
}
