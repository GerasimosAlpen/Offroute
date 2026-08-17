import { Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;

/**
 * SSRF defence for the in-app browser proxy.
 *
 * The proxy fetches an arbitrary user-supplied URL server-side, so without this
 * it is a confused deputy: anything the server can reach — the Postgres box,
 * a cloud metadata endpoint at 169.254.169.254, other services on the LAN —
 * becomes reachable by anyone who can call GET /proxy?url=.
 *
 * Hostname string matching alone is NOT sufficient, which is what this replaced:
 *
 *   1. DNS rebinding. `evil.example.com` is a perfectly ordinary hostname that
 *      resolves to 127.0.0.1. A string check never sees it.
 *   2. Redirects. A public URL that 302s to http://169.254.169.254/ passes the
 *      check on the way in, then lands somewhere internal.
 *   3. Alternative encodings — 0x7f.0.0.1, 2130706433, IPv6-mapped IPv4.
 *
 * So: resolve every hostname and check the actual addresses, and follow
 * redirects manually, re-checking each hop.
 */
function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host === "" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  );
}

function isPrivateAddress(address: string, family: number): boolean {
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true; // unknown family — refuse rather than guess
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // unparseable — refuse
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone index

  if (addr === "::1" || addr === "::") return true;
  if (addr.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(addr)) return true; // unique-local fc00::/7

  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible forms tunnel the whole
  // IPv4 problem through IPv6 — unwrap and re-check.
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return false;
}

/**
 * Resolves a hostname and reports whether ANY address it maps to is private.
 * All of them must be public — a name resolving to both a public and a private
 * address is a rebinding attempt, not a coincidence.
 */
async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  const bare = hostname.replace(/^\[|\]$/g, "");

  // A literal IP needs no DNS round trip.
  const literal = isIP(bare);
  if (literal) return isPrivateAddress(bare, literal);

  try {
    const results = await lookup(bare, { all: true });
    if (results.length === 0) return true;
    return results.some((r) => isPrivateAddress(r.address, r.family));
  } catch {
    return true; // cannot resolve — refuse
  }
}
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export interface ProxyResult {
  contentType: string;
  body: Buffer | string;
}

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchJson(url: string, ms = 7000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await globalThis.fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Friendly in-frame error page — better than raw JSON showing inside the browser window. */
function errorPage(message: string, detail?: string): ProxyResult {
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#131313;color:#e5e2e1;font-family:ui-monospace,monospace}
.box{max-width:420px;text-align:center;padding:24px;border:1px solid #444;background:#1a1a1a}
h1{color:#ff6b81;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px}
p{color:#a8b3a8;font-size:12px;line-height:1.6;margin:4px 0}</style></head>
<body><div class="box"><h1>Tidak bisa memuat halaman</h1><p>${message}</p>${detail ? `<p style="color:#666">${detail}</p>` : ""}
<p style="color:#666">Situs mungkin memblokir tampilan dalam peramban internal. Coba alamat lain.</p></div></body></html>`;
  return { contentType: "text/html; charset=utf-8", body };
}

/**
 * A read-only fetching proxy so radar's in-OS browser can render pages inside
 * an iframe. It strips the response's frame-blocking headers
 * (`x-frame-options`, framing CSP) — which is exactly why an iframe alone
 * can't show most sites — and rewrites `<a>`/`<form>` targets to route back
 * through the proxy so navigation stays inside the radar. Assets resolve
 * directly against the origin via an injected `<base>`.
 */
@Injectable()
export class ProxyService {
  /** Returns the parsed URL, or a friendly error result if it's invalid/blocked. */
  private validate(raw: string): URL | ProxyResult {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return errorPage("Alamat tidak valid.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return errorPage("Hanya alamat http/https yang didukung.");
    }
    // Cheap hostname-shaped rejection. This is only the first gate — it cannot
    // be trusted on its own, because a hostname says nothing about the address
    // it resolves to. resolvesToPrivateAddress() below is the real check.
    if (isPrivateHostname(url.hostname)) {
      return errorPage("Alamat lokal/jaringan internal tidak diizinkan.");
    }
    return url;
  }

  async fetch(rawUrl: string, selfOrigin: string): Promise<ProxyResult> {
    const target = this.validate(rawUrl);
    if (!(target instanceof URL)) return target; // error page

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    let current = target;
    try {
      // Redirects are followed by hand, one hop at a time, so each destination
      // gets the same address check as the original URL. With redirect:"follow"
      // the runtime would chase a 302 into the LAN or a metadata endpoint
      // before we ever saw where it went.
      for (let hop = 0; ; hop++) {
        if (await resolvesToPrivateAddress(current.hostname)) {
          return errorPage("Alamat lokal/jaringan internal tidak diizinkan.", current.hostname);
        }

        res = await globalThis.fetch(current.toString(), {
          headers: { "User-Agent": UA, Accept: "text/html,*/*" },
          redirect: "manual",
          signal: controller.signal,
        });

        const location = res.headers.get("location");
        if (![301, 302, 303, 307, 308].includes(res.status) || !location) break;

        if (hop >= MAX_REDIRECTS) {
          return errorPage("Terlalu banyak pengalihan (redirect).", current.hostname);
        }

        const next = new URL(location, current);
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return errorPage("Pengalihan ke protokol yang tidak didukung.", next.protocol);
        }
        if (isPrivateHostname(next.hostname)) {
          return errorPage("Alamat lokal/jaringan internal tidak diizinkan.", next.hostname);
        }
        current = next;
      }
    } catch {
      return errorPage("Gagal terhubung ke situs.", current.hostname);
    } finally {
      clearTimeout(timer);
    }

    // With manual redirects res.url is the URL we actually requested last,
    // which is what relative-link rewriting must resolve against.
    const finalUrl = current.toString();
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return { contentType: "text/plain; charset=utf-8", body: "Halaman terlalu besar untuk ditampilkan." };
    }

    if (!contentType.includes("text/html")) {
      // Non-HTML (image, css, pdf …) — pass through untouched.
      return { contentType, body: buf };
    }

    const html = this.rewriteHtml(buf.toString("utf-8"), finalUrl, selfOrigin);
    return { contentType: "text/html; charset=utf-8", body: html };
  }

  private rewriteHtml(html: string, finalUrl: string, selfOrigin: string): string {
    const origin = new URL(finalUrl).origin;
    const proxied = (abs: string) => `${selfOrigin}/proxy?url=${encodeURIComponent(abs)}`;
    const toAbs = (href: string): string | null => {
      try {
        return new URL(href, finalUrl).toString();
      } catch {
        return null;
      }
    };

    // Route anchor + form navigation through the proxy so clicks stay inside.
    const rewriteAttr = (tag: "a" | "form", attr: "href" | "action", s: string) =>
      s.replace(
        new RegExp(`(<${tag}\\b[^>]*?\\s${attr}=)(["'])(.*?)\\2`, "gi"),
        (m, pre, q, val) => {
          if (!val || /^(javascript:|mailto:|tel:|data:|#)/i.test(val)) return m;
          const abs = toAbs(val);
          return abs ? `${pre}${q}${proxied(abs)}${q}` : m;
        },
      );

    let out = html;
    out = rewriteAttr("a", "href", out);
    out = rewriteAttr("form", "action", out);

    // `<base>` so relative assets (css/js/img) load straight from the origin.
    const baseTag = `<base href="${origin}/">`;
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    } else {
      out = baseTag + out;
    }
    return out;
  }

  // ─── Search ──────────────────────────────────────────────────────────────
  // Search-engine result pages actively block being scraped/proxied (DuckDuckGo
  // refused to even connect from the server). So instead of proxying someone
  // else's results page, we query keyless data APIs that DON'T block, merge
  // whatever's reachable, and render OUR OWN results page — which is always
  // framable because we serve it. Each result opens in-frame via /proxy.

  private async ddgAnswers(q: string): Promise<SearchHit[]> {
    const d = await fetchJson(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1&t=offroute`,
    );
    if (!d) return [];
    const hits: SearchHit[] = [];
    if (d.AbstractText && d.AbstractURL) {
      hits.push({ title: d.Heading || q, url: d.AbstractURL, snippet: d.AbstractText, source: "DuckDuckGo" });
    }
    const walk = (arr: any[]) => {
      for (const t of arr ?? []) {
        if (t?.FirstURL && t?.Text) hits.push({ title: t.Text, url: t.FirstURL, snippet: t.Text, source: "DuckDuckGo" });
        else if (Array.isArray(t?.Topics)) walk(t.Topics);
      }
    };
    walk(d.RelatedTopics);
    return hits;
  }

  private async wikiSearch(q: string): Promise<SearchHit[]> {
    // Indonesian Wikipedia — reliable, keyless, CORS-open, rarely blocks.
    const d = await fetchJson(
      `https://id.wikipedia.org/w/api.php?action=opensearch&limit=8&namespace=0&format=json&search=${encodeURIComponent(q)}`,
    );
    if (!Array.isArray(d)) return [];
    const [, titles, descs, urls] = d as [string, string[], string[], string[]];
    return (titles ?? []).map((t, i) => ({
      title: t,
      url: urls?.[i] ?? "",
      snippet: descs?.[i] || "Artikel Wikipedia",
      source: "Wikipedia",
    })).filter((h) => h.url);
  }

  private async searxng(q: string): Promise<SearchHit[]> {
    // A public SearXNG metasearch instance — real web results when reachable
    // (many rate-limit or disable the JSON API, so it's best-effort).
    const d = await fetchJson(`https://searx.be/search?q=${encodeURIComponent(q)}&format=json`, 6000);
    if (!d?.results) return [];
    return (d.results as any[]).slice(0, 10).map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      snippet: r.content ?? "",
      source: "Web",
    })).filter((h) => h.url);
  }

  async search(q: string, selfOrigin: string): Promise<ProxyResult> {
    const query = (q ?? "").trim();
    if (!query) return this.renderResults("", []);

    const settled = await Promise.allSettled([this.searxng(query), this.ddgAnswers(query), this.wikiSearch(query)]);
    const all = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));

    // De-dupe by URL, preserving order (searxng → ddg → wiki).
    const seen = new Set<string>();
    const hits = all.filter((h) => {
      const key = h.url.replace(/\/+$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);

    return this.renderResults(query, hits, selfOrigin);
  }

  private renderResults(query: string, hits: SearchHit[], selfOrigin = ""): ProxyResult {
    const proxied = (u: string) => `${selfOrigin}/proxy?url=${encodeURIComponent(u)}`;
    const rows = hits
      .map(
        (h) => `<a class="hit" href="${esc(proxied(h.url))}">
          <div class="src">${esc(h.source)}</div>
          <div class="title">${esc(h.title)}</div>
          <div class="url">${esc(h.url)}</div>
          ${h.snippet ? `<div class="snip">${esc(h.snippet)}</div>` : ""}
        </a>`,
      )
      .join("");
    const empty = `<div class="empty"><p>Tidak ada hasil untuk "<b>${esc(query)}</b>".</p>
      <p>Jaringan mungkin memblokir mesin pencari dari sisi server. Coba ketik alamat situs langsung.</p></div>`;
    const body = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;background:#131313;color:#e5e2e1;font-family:ui-monospace,SFMono-Regular,monospace;padding:16px}
  .q{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-bottom:1px solid #333;padding-bottom:8px}
  .q b{color:#5fb3b3}
  .hit{display:block;text-decoration:none;padding:10px 12px;margin-bottom:8px;border:1px solid #333;background:#1a1a1a}
  .hit:hover{border-color:#5fb3b3}
  .src{font-size:9px;color:#5fb3b3;text-transform:uppercase;letter-spacing:1px}
  .title{color:#9cc0e0;font-size:14px;margin:2px 0}
  .url{color:#66a06b;font-size:11px;word-break:break-all}
  .snip{color:#a8b3a8;font-size:12px;margin-top:4px;line-height:1.4}
  .empty{color:#a8b3a8;font-size:13px;line-height:1.7;text-align:center;padding:40px 12px}
</style></head><body>
<div class="q">Hasil pencarian: <b>${esc(query)}</b> · ${hits.length} hasil</div>
${hits.length ? rows : empty}
</body></html>`;
    return { contentType: "text/html; charset=utf-8", body };
  }
}
