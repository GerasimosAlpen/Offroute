import { useState } from "preact/hooks";
import { Search, Globe, ArrowRight, MapPin, Waves, BookOpen } from "lucide-preact";
import { isTauri } from "@/lib/tauri";

/** Opens a URL in the real browser — the opener plugin on desktop, a new tab on web. */
async function openExternal(url: string) {
  if (isTauri) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return true;
    } catch {
      // fall through to window.open
    }
  }
  window.open(url, "_blank", "noopener");
  return true;
}

function toUrl(query: string): string {
  const q = query.trim();
  if (!q) return "";
  // Looks like a URL/domain → navigate directly; otherwise Google-search it.
  if (/^https?:\/\//i.test(q)) return q;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q)) return `https://${q}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

const BOOKMARKS: { label: string; url: string; icon: typeof Globe }[] = [
  { label: "Google", url: "https://www.google.com", icon: Search },
  { label: "Maps", url: "https://www.google.com/maps", icon: MapPin },
  { label: "OSM", url: "https://www.openstreetmap.org", icon: Globe },
  { label: "BMKG", url: "https://www.bmkg.go.id", icon: Waves },
  { label: "Wikipedia", url: "https://id.wikipedia.org", icon: BookOpen },
];

/**
 * "Peramban" — the radar OS web app. Type a search or URL and it opens in the
 * real browser (opener plugin on desktop, a new tab on web). A true embedded
 * webview isn't possible here — Google and most sites block being framed via
 * X-Frame-Options — so this delegates the actual page to the system browser,
 * which is reliable and still lets the operator google from inside the OS.
 */
export function WebBrowserPanel() {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const go = async (input: string) => {
    const url = toUrl(input);
    if (!url) return;
    await openExternal(url);
    setNote(`Membuka di peramban: ${url.slice(0, 60)}${url.length > 60 ? "…" : ""}`);
    setRecent((r) => [input, ...r.filter((x) => x !== input)].slice(0, 6));
  };

  return (
    <div className="flex-1 min-h-0 bg-[#262626] border border-[#444] flex flex-col overflow-hidden">
      <header className="shrink-0 h-9 flex items-center gap-2 px-3 bg-[#131313] border-b border-[#444]">
        <Globe size={13} className="text-[#e5e2e1]" />
        <span className="text-[#e5e2e1] text-sm tracking-[1.4px] uppercase">Peramban</span>
      </header>

      {/* Address / search bar */}
      <div className="shrink-0 flex items-center gap-1.5 p-2 border-b border-[#444] bg-[#1a1a1a]">
        <Search size={13} className="text-[#666] shrink-0 ml-1" />
        <input
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && go(q)}
          placeholder="Cari di Google atau ketik URL…"
          className="flex-1 bg-transparent text-[#e5e2e1] font-mono text-xs outline-none placeholder:text-[#555]"
          spellcheck={false}
          autocapitalize="off"
        />
        <button
          type="button"
          onClick={() => go(q)}
          disabled={!q.trim()}
          className="shrink-0 size-6 flex items-center justify-center border border-[#444] text-[#5fb3b3] hover:bg-[#5fb3b3]/10 disabled:opacity-30"
          title="Buka"
        >
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Bookmarks */}
      <div className="shrink-0 flex flex-wrap gap-1.5 p-2 border-b border-[#444]">
        {BOOKMARKS.map((b) => {
          const Icon = b.icon;
          return (
            <button
              key={b.label}
              type="button"
              onClick={() => go(b.url)}
              className="flex items-center gap-1 px-2 py-1 border border-[#333] bg-[#1a1a1a] text-[#c0b0b3] font-mono text-[10px] uppercase tracking-wide hover:border-[#5fb3b3] hover:text-[#5fb3b3] transition-colors"
            >
              <Icon size={11} /> {b.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
        {note && <p className="font-mono text-[10px] text-[#5fb3b3]">{note}</p>}
        {recent.length > 0 && (
          <>
            <span className="font-mono text-[9px] text-[#666] uppercase tracking-widest">Terakhir dibuka</span>
            {recent.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(r)}
                className="text-left font-mono text-[11px] text-[#a8b3a8] hover:text-[#e5e2e1] truncate"
              >
                › {r}
              </button>
            ))}
          </>
        )}
        {recent.length === 0 && !note && (
          <p className="font-mono text-[10px] text-[#555]">
            Cari apa saja atau buka salah satu pintasan di atas. Halaman terbuka di peramban sistem.
          </p>
        )}
      </div>
    </div>
  );
}
