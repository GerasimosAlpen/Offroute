import { useEffect, useRef, useState } from "preact/hooks";
import Database from "@tauri-apps/plugin-sql";
import { Database as DbIcon } from "lucide-preact";
import { isTauri } from "@/lib/tauri";
import { DB_NAME } from "@/lib/config";
import { Card } from "./Card";
import { btn } from "./styles";

type NoteRow = { id: number; text: string };

const MOCK_NOTES: NoteRow[] = [
  { id: 3, text: "SQLite wired up via tauri-plugin-sql" },
  { id: 2, text: "Embedded DB — no server needed" },
  { id: 1, text: "offroute.db lives in app data dir" },
];

export function SQLiteCard() {
  const mockRef = useRef(MOCK_NOTES.map((n) => ({ ...n })));
  const [notes, setNotes] = useState<NoteRow[]>(
    isTauri ? [] : mockRef.current,
  );
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function setup() {
    if (!isTauri) return;
    try {
      const db = await Database.load(DB_NAME);
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
      const db = await Database.load(DB_NAME);
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
