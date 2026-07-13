import { useState, useEffect, useRef } from "preact/hooks";

// true only when running inside the Tauri binary
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import Database from "@tauri-apps/plugin-sql";
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";
import { useQuery } from "@tanstack/preact-query";
import axios from "axios";
import * as v from "valibot";
import { Effect } from "effect";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  Zap,
  Bell,
  Database as DbIcon,
  Lock,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wind,
  Palette,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-preact";
import { useDemoStore } from "./store/demo";

// leaflet's default marker icons reference paths that break under bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ── shared primitives ─────────────────────────────────────────────────────────

const btn =
  "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40";
const primaryBtn = `${btn} bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white`;
const ghostBtn = `${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-300`;

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      class={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${color}`}
    >
      {label}
    </span>
  );
}

function Card({
  icon,
  title,
  badge,
  badgeColor,
  tauriOnly = false,
  children,
  delay = 0,
}: {
  icon: preact.ComponentChildren;
  title: string;
  badge: string;
  badgeColor: string;
  tauriOnly?: boolean;
  children: preact.ComponentChildren;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">{icon}</div>
          <span class="text-sm font-semibold text-white">{title}</span>
        </div>
        <div class="flex items-center gap-1.5">
          {tauriOnly && !isTauri && (
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full border text-zinc-500 border-zinc-700 bg-zinc-800">
              offline
            </span>
          )}
          <Badge label={badge} color={badgeColor} />
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// ── Tauri IPC ─────────────────────────────────────────────────────────────────

function TauriCard() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(
    isTauri ? null : "Hello, world aku sontoloyo  [mock]",
  );

  async function run() {
    if (!isTauri) {
      setResult(`Hello, ${name || "world"} aku sontoloyo  [mock]`);
      return;
    }
    const res = await invoke<string>("greet", { name: name || "world" });
    setResult(res);
  }

  return (
    <Card
      icon={<Zap size={14} />}
      title="Tauri IPC"
      badge="invoke"
      badgeColor="text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
      tauriOnly
      delay={0}
    >
      <p class="text-xs text-zinc-500">Call Rust commands from Preact.</p>
      <div class="flex gap-2">
        <input
          class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
          placeholder="your name"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button class={primaryBtn} onClick={run}>
          Invoke
        </button>
      </div>
      {result && (
        <p class="text-xs text-emerald-400 font-mono bg-zinc-800 rounded-lg px-3 py-2 truncate">
          {result}
        </p>
      )}
    </Card>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

function NotificationCard() {
  const [status, setStatus] = useState<string | null>(
    isTauri ? null : "Would fire: Offroute — Notifications are wired up!  [mock]",
  );

  async function fire() {
    if (!isTauri) {
      setStatus("Would fire: Offroute — Notifications are wired up!  [mock]");
      return;
    }
    setStatus("requesting…");
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        // "default" = user hasn't decided yet, still attempt on macOS
        granted = perm === "granted" || perm === "default";
        setStatus(`permission: ${perm}`);
      }
      if (!granted) { setStatus("permission denied — enable in System Settings"); return; }
      await sendNotification({ title: "Offroute", body: "Notifications are wired up!" });
      setStatus("sent!");
    } catch (e) {
      setStatus(`error: ${String(e)}`);
    }
  }

  return (
    <Card
      icon={<Bell size={14} />}
      title="Notifications"
      badge="plugin"
      badgeColor="text-amber-400 border-amber-500/30 bg-amber-500/10"
      tauriOnly
      delay={0.05}
    >
      <p class="text-xs text-zinc-500">OS-native notifications via Tauri plugin.</p>
      <button class={primaryBtn} onClick={fire}>
        Send notification
      </button>
      {status && <p class="text-xs font-mono text-amber-400">{status}</p>}
    </Card>
  );
}

// ── SQLite ────────────────────────────────────────────────────────────────────

type NoteRow = { id: number; text: string };

const MOCK_NOTES: NoteRow[] = [
  { id: 3, text: "SQLite wired up via tauri-plugin-sql" },
  { id: 2, text: "Embedded DB — no server needed" },
  { id: 1, text: "offroute.db lives in app data dir" },
];

function SQLiteCard() {
  const mockRef = useRef(MOCK_NOTES.map((n) => ({ ...n })));
  const [notes, setNotes] = useState<NoteRow[]>(
    isTauri ? [] : mockRef.current,
  );
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function setup() {
    if (!isTauri) return;
    try {
      const db = await Database.load("sqlite:offroute.db");
      await db.execute(
        "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL)",
      );
      const rows = await db.select<NoteRow[]>(
        "SELECT * FROM notes ORDER BY id DESC LIMIT 4",
      );
      setNotes(rows);
      setStatus("connected");
    } catch {
      setStatus("error");
    }
  }

  async function insert() {
    if (!input.trim()) return;
    if (!isTauri) {
      const next = { id: mockRef.current.length + 1, text: input.trim() };
      mockRef.current = [next, ...mockRef.current].slice(0, 4);
      setNotes([...mockRef.current]);
      setInput("");
      return;
    }
    try {
      const db = await Database.load("sqlite:offroute.db");
      await db.execute("INSERT INTO notes (text) VALUES (?)", [input.trim()]);
      setInput("");
      const rows = await db.select<NoteRow[]>(
        "SELECT * FROM notes ORDER BY id DESC LIMIT 4",
      );
      setNotes(rows);
    } catch { setStatus("error"); }
  }

  useEffect(() => { setup(); }, []);

  return (
    <Card
      icon={<DbIcon size={14} />}
      title="SQLite"
      badge="tauri-plugin-sql"
      badgeColor="text-teal-400 border-teal-500/30 bg-teal-500/10"
      tauriOnly
      delay={0.1}
    >
      <p class="text-xs text-zinc-500">Embedded local database. No server needed.</p>
      <div class="flex gap-2">
        <input
          class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-teal-500 transition-colors"
          placeholder="new note…"
          value={input}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && insert()}
        />
        <button class={`${btn} bg-teal-700 hover:bg-teal-600 text-white`} onClick={insert}>
          Insert
        </button>
      </div>
      {notes.length > 0 ? (
        <ul class="space-y-1">
          {notes.map((n) => (
            <li
              key={n.id}
              class="text-xs text-zinc-400 font-mono bg-zinc-800 rounded-lg px-3 py-1.5 truncate"
            >
              #{n.id} {n.text}
            </li>
          ))}
        </ul>
      ) : (
        <p class="text-xs font-mono text-zinc-600">{status ?? "initializing…"}</p>
      )}
    </Card>
  );
}

// ── Stronghold ────────────────────────────────────────────────────────────────

function StrongholdCard() {
  const mockVault = useRef<Record<string, string>>({
    "demo-secret": "super-secret-value  [mock]",
  });
  const [secret, setSecret] = useState("");
  const [retrieved, setRetrieved] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    isTauri ? null : "vault ready (Argon2id)  [mock]",
  );

  async function save() {
    if (!secret.trim()) return;
    if (!isTauri) {
      mockVault.current["demo-secret"] = secret.trim();
      setStatus("saved  [mock]");
      setSecret("");
      return;
    }
    try {
      const dir = await appDataDir();
      const stronghold = await Stronghold.load(`${dir}/offroute.hold`, "dev-password");
      const client = await stronghold.loadClient("offroute-client");
      const store = client.getStore();
      await store.insert(
        "demo-secret",
        Array.from(new TextEncoder().encode(secret.trim())),
      );
      await stronghold.save();
      setStatus("saved");
      setSecret("");
    } catch (e) { setStatus(String(e).slice(0, 60)); }
  }

  async function load() {
    if (!isTauri) {
      setRetrieved(mockVault.current["demo-secret"] ?? "(empty)");
      return;
    }
    try {
      const dir = await appDataDir();
      const stronghold = await Stronghold.load(`${dir}/offroute.hold`, "dev-password");
      const client = await stronghold.loadClient("offroute-client");
      const store = client.getStore();
      const raw = await store.get("demo-secret");
      setRetrieved(
        raw ? new TextDecoder().decode(new Uint8Array(raw)) : "(empty)",
      );
    } catch (e) { setStatus(String(e).slice(0, 60)); }
  }

  return (
    <Card
      icon={<Lock size={14} />}
      title="Stronghold"
      badge="encrypted"
      badgeColor="text-rose-400 border-rose-500/30 bg-rose-500/10"
      tauriOnly
      delay={0.15}
    >
      <p class="text-xs text-zinc-500">Encrypted secret storage via Argon2id vault.</p>
      <div class="flex gap-2">
        <input
          class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-rose-500 transition-colors"
          placeholder="secret value…"
          value={secret}
          onInput={(e) => setSecret(e.currentTarget.value)}
        />
        <button class={`${btn} bg-rose-700 hover:bg-rose-600 text-white`} onClick={save}>
          Save
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button class={ghostBtn} onClick={load}>
          Read secret
        </button>
        {retrieved && (
          <span class="text-xs font-mono text-rose-400 truncate">→ {retrieved}</span>
        )}
      </div>
      {status && (
        <p class="text-xs font-mono text-zinc-500 truncate">{status}</p>
      )}
    </Card>
  );
}

// ── Zustand ───────────────────────────────────────────────────────────────────

function ZustandCard() {
  const { count, messages, increment, decrement, reset, push } = useDemoStore();

  return (
    <Card
      icon={<Layers size={14} />}
      title="Zustand"
      badge="v5"
      badgeColor="text-orange-400 border-orange-500/30 bg-orange-500/10"
      delay={0.2}
    >
      <p class="text-xs text-zinc-500">Global state — no context boilerplate.</p>
      <div class="flex items-center gap-3">
        <button class={ghostBtn} onClick={decrement}>−</button>
        <span class="text-2xl font-bold text-white w-10 text-center tabular-nums">{count}</span>
        <button class={ghostBtn} onClick={increment}>+</button>
        <button class={`${btn} ml-auto text-zinc-500 hover:text-zinc-300`} onClick={reset}>reset</button>
      </div>
      <button
        class={ghostBtn}
        onClick={() => push(`event at ${new Date().toLocaleTimeString()}`)}
      >
        Push message
      </button>
      {messages.length > 0 && (
        <ul class="space-y-1">
          {messages.map((m, i) => (
            <li key={i} class="text-xs font-mono text-zinc-500 truncate">{m}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── TanStack Query ────────────────────────────────────────────────────────────

function QueryCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["nestjs-health"],
    queryFn: () => axios.get("http://localhost:3000/").then((r) => r.data),
    enabled: false,
    retry: false,
  });

  return (
    <Card
      icon={<RefreshCw size={14} />}
      title="TanStack Query"
      badge="preact"
      badgeColor="text-sky-400 border-sky-500/30 bg-sky-500/10"
      delay={0.25}
    >
      <p class="text-xs text-zinc-500">
        Server state + caching. Pings NestJS at <code class="text-zinc-400">:3000</code>.
      </p>
      <button
        class={`${primaryBtn} flex items-center gap-1.5`}
        onClick={() => refetch()}
        disabled={isFetching}
      >
        {isFetching ? <Loader2 size={12} class="animate-spin" /> : <RefreshCw size={12} />}
        Fetch
      </button>
      {isLoading && <p class="text-xs text-zinc-500">loading…</p>}
      {isError && (
        <p class="text-xs font-mono text-red-400 truncate">
          {(error as Error).message}
        </p>
      )}
      {data && (
        <pre class="text-xs font-mono text-emerald-400 bg-zinc-800 rounded-lg p-2 overflow-auto max-h-20">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </Card>
  );
}

// ── Valibot ───────────────────────────────────────────────────────────────────

const emailSchema = v.object({
  email: v.pipe(v.string(), v.email("Invalid email")),
  name: v.pipe(v.string(), v.minLength(2, "Min 2 chars")),
});

function ValibotCard() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [valid, setValid] = useState<boolean | null>(null);

  function validate() {
    const result = v.safeParse(emailSchema, { email, name });
    if (result.success) {
      setErrors({});
      setValid(true);
    } else {
      const map: Record<string, string> = {};
      for (const issue of result.issues) {
        const key = String(issue.path?.[0]?.key ?? "field");
        map[key] = issue.message;
      }
      setErrors(map);
      setValid(false);
    }
  }

  return (
    <Card
      icon={<ShieldCheck size={14} />}
      title="Valibot"
      badge="validation"
      badgeColor="text-lime-400 border-lime-500/30 bg-lime-500/10"
      delay={0.3}
    >
      <p class="text-xs text-zinc-500">Schema validation — typesafe, tree-shakeable.</p>
      <div class="space-y-2">
        <div>
          <input
            class={`w-full bg-zinc-800 border rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors ${errors.name ? "border-red-500 focus:border-red-400" : "border-zinc-700 focus:border-lime-500"}`}
            placeholder="name"
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          {errors.name && <p class="text-[10px] text-red-400 mt-0.5 ml-1">{errors.name}</p>}
        </div>
        <div>
          <input
            class={`w-full bg-zinc-800 border rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors ${errors.email ? "border-red-500 focus:border-red-400" : "border-zinc-700 focus:border-lime-500"}`}
            placeholder="email"
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
          {errors.email && <p class="text-[10px] text-red-400 mt-0.5 ml-1">{errors.email}</p>}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class={`${btn} bg-lime-700 hover:bg-lime-600 text-white`} onClick={validate}>
          Validate
        </button>
        {valid === true && <CheckCircle2 size={14} class="text-emerald-400" />}
        {valid === false && <XCircle size={14} class="text-red-400" />}
      </div>
    </Card>
  );
}

// ── Effect-TS ─────────────────────────────────────────────────────────────────

function EffectCard() {
  const [output, setOutput] = useState<string | null>(null);

  function run() {
    const program = Effect.succeed({ user: "offroute", ts: Date.now() }).pipe(
      Effect.map((data) => ({ ...data, processed: true })),
      Effect.flatMap((data) =>
        data.processed
          ? Effect.succeed(data)
          : Effect.fail(new Error("not processed")),
      ),
    );

    Effect.runPromise(program)
      .then((r) => setOutput(JSON.stringify(r)))
      .catch((e) => setOutput(`Error: ${e.message}`));
  }

  return (
    <Card
      icon={<Sparkles size={14} />}
      title="Effect-TS"
      badge="fp"
      badgeColor="text-violet-400 border-violet-500/30 bg-violet-500/10"
      delay={0.35}
    >
      <p class="text-xs text-zinc-500">Typed effects, composable error handling.</p>
      <button class={`${btn} bg-violet-700 hover:bg-violet-600 text-white`} onClick={run}>
        Run effect
      </button>
      {output && (
        <pre class="text-xs font-mono text-violet-300 bg-zinc-800 rounded-lg p-2 overflow-auto">
          {output}
        </pre>
      )}
    </Card>
  );
}

// ── Framer Motion ─────────────────────────────────────────────────────────────

function FramerCard() {
  const [active, setActive] = useState(false);

  return (
    <Card
      icon={<Wind size={14} />}
      title="Framer Motion"
      badge="animation"
      badgeColor="text-pink-400 border-pink-500/30 bg-pink-500/10"
      delay={0.4}
    >
      <p class="text-xs text-zinc-500">Production-ready animations and gestures.</p>
      <div class="flex items-center gap-4">
        <motion.div
          animate={{
            scale: active ? 1.4 : 1,
            rotate: active ? 180 : 0,
            backgroundColor: active ? "#ec4899" : "#3f3f46",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          class="w-10 h-10 rounded-xl"
        />
        <motion.div
          animate={{ x: active ? 60 : 0, opacity: active ? 1 : 0.4 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          class="w-3 h-3 rounded-full bg-pink-500"
        />
        <button
          class={`${btn} ml-auto bg-pink-700 hover:bg-pink-600 text-white`}
          onClick={() => setActive((v) => !v)}
        >
          {active ? "Reset" : "Animate"}
        </button>
      </div>
    </Card>
  );
}

// ── React Leaflet ─────────────────────────────────────────────────────────────

function MapCard() {
  const jakarta: [number, number] = [-6.1754, 106.8272];

  return (
    <Card
      icon={<MapPin size={14} />}
      title="React Leaflet"
      badge="map"
      badgeColor="text-green-400 border-green-500/30 bg-green-500/10"
      delay={0.55}
    >
      <p class="text-xs text-zinc-500">Interactive Leaflet maps via preact/compat.</p>
      <div class="h-40 w-full rounded-lg overflow-hidden z-0">
        <MapContainer
          center={jakarta}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={jakarta}>
            <Popup>Offroute HQ</Popup>
          </Marker>
        </MapContainer>
      </div>
    </Card>
  );
}

// ── Tailwind v4 ───────────────────────────────────────────────────────────────

function TailwindCard() {
  return (
    <Card
      icon={<Palette size={14} />}
      title="Tailwind CSS v4"
      badge="vite plugin"
      badgeColor="text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
      delay={0.45}
    >
      <p class="text-xs text-zinc-500">Zero-runtime utility CSS via Vite plugin — no PostCSS.</p>
      <div class="flex gap-1.5 flex-wrap">
        {["bg-indigo-500", "bg-sky-500", "bg-teal-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-pink-500", "bg-violet-500"].map(
          (c) => (
            <div key={c} class={`w-7 h-7 rounded-lg ${c}`} title={c} />
          ),
        )}
      </div>
      <div class="flex gap-2 flex-wrap">
        <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 animate-pulse">pulse</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 animate-bounce">bounce</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 animate-spin">spin</span>
      </div>
    </Card>
  );
}

// ── Lucide Icons ──────────────────────────────────────────────────────────────

function LucideCard() {
  const icons = [
    Zap, Bell, DbIcon, Lock, Layers, RefreshCw,
    ShieldCheck, Sparkles, Wind, Palette,
  ];

  return (
    <Card
      icon={<Sparkles size={14} />}
      title="Lucide Icons"
      badge="lucide-preact"
      badgeColor="text-zinc-400 border-zinc-600 bg-zinc-800"
      delay={0.5}
    >
      <p class="text-xs text-zinc-500">5000+ icons, tree-shakeable, Preact native.</p>
      <div class="flex gap-3 flex-wrap">
        {icons.map((Icon, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.3, color: "#818cf8" }}
            class="text-zinc-400 cursor-default"
          >
            <Icon size={18} />
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

const stack = [
  "Tauri v2", "Preact", "TypeScript", "Vite 6",
  "Tailwind v4", "Zustand v5", "TanStack Query",
  "Axios", "Valibot", "Effect-TS", "Framer Motion",
  "Lucide", "SQLite", "Stronghold", "NestJS", "React Leaflet",
];

export default function App() {
  return (
    <div class="min-h-screen bg-zinc-950 text-zinc-100">
      {/* header */}
      <header class="border-b border-zinc-800/60 px-6 py-4">
        <div class="max-w-5xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={1.5}>
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
              </svg>
            </div>
            <div>
              <h1 class="text-sm font-semibold text-white">Offroute</h1>
              <p class="text-[10px] text-zinc-500">
                Tech Stack Playground
                {!isTauri && (
                  <span class="ml-1.5 text-amber-500/80">· browser / offline mode</span>
                )}
              </p>
            </div>
          </div>
          <div class="hidden sm:flex gap-1.5 flex-wrap justify-end max-w-sm">
            {stack.map((s) => (
              <span key={s} class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-500 border border-zinc-700/50">
                {s}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* grid */}
      <main class="max-w-5xl mx-auto px-6 py-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TauriCard />
          <NotificationCard />
          <SQLiteCard />
          <StrongholdCard />
          <ZustandCard />
          <QueryCard />
          <ValibotCard />
          <EffectCard />
          <FramerCard />
          <TailwindCard />
          <LucideCard />
          <MapCard />
        </div>
      </main>
    </div>
  );
}
