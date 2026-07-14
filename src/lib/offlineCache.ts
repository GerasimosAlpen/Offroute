import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "./tauri";

/**
 * Real offline cache, backed by SQLite (same `offroute.db` file the demo
 * SQLite card already opens — new tables here, no conflict). Two concerns:
 *
 * 1. `cache_entities` — last-known-good copies of whatever a store's
 *    `loadX()` most recently fetched, so a backend outage shows real stale
 *    data instead of a blank/hardcoded placeholder.
 * 2. `mutation_queue` — writes that failed while offline, replayed once the
 *    app is back online.
 *
 * Deliberately domain-agnostic (one generic pair of tables, not one
 * hand-rolled table per store) so every store wires into the same small
 * API rather than each reinventing this. Every function no-ops outside
 * Tauri, same as `persist.ts`/`SQLiteCard.tsx` already do — there's nothing
 * to fall back to in a plain browser dev session, and that's fine, the
 * in-memory hardcoded fallbacks each store already has still apply there.
 */

const DB_PATH = "sqlite:offroute.db";
let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_PATH).then(async (db) => {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS cache_entities (
          domain TEXT NOT NULL,
          id TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (domain, id)
        )`,
      );
      await db.execute(
        `CREATE TABLE IF NOT EXISTS mutation_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT NOT NULL,
          method TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retries INTEGER NOT NULL DEFAULT 0
        )`,
      );
      return db;
    });
  }
  return dbPromise;
}

/** Call once on app start (no-op outside Tauri) so the tables exist before anything tries to read/write them. */
export async function initOfflineCache(): Promise<void> {
  if (!isTauri) return;
  try {
    await getDb();
  } catch (err) {
    console.warn("[offlineCache] Failed to initialize SQLite cache:", err);
  }
}

interface CacheRow {
  payload: string;
}

/** Records must carry an `id` — that plus `domain` is the cache key. */
export async function cacheSet(domain: string, records: { id: string }[]): Promise<void> {
  if (!isTauri) return;
  try {
    const db = await getDb();
    // Replace the whole domain's rows with the latest fetch, rather than
    // leaving stale entries around for records the server no longer has.
    await db.execute("DELETE FROM cache_entities WHERE domain = ?", [domain]);
    const now = Date.now();
    for (const record of records) {
      if (!record?.id) continue; // skip malformed rows rather than throw
      await db.execute(
        "INSERT OR REPLACE INTO cache_entities (domain, id, payload, updated_at) VALUES (?, ?, ?, ?)",
        [domain, record.id, JSON.stringify(record), now],
      );
    }
  } catch (err) {
    console.warn(`[offlineCache] Failed to cache "${domain}":`, err);
  }
}

/** Empty array outside Tauri, on any failure, or if nothing's cached yet — never throws. */
export async function cacheGetAll<T>(domain: string): Promise<T[]> {
  if (!isTauri) return [];
  try {
    const db = await getDb();
    const rows = await db.select<CacheRow[]>(
      "SELECT payload FROM cache_entities WHERE domain = ? ORDER BY updated_at DESC",
      [domain],
    );
    const result: T[] = [];
    for (const row of rows) {
      try {
        result.push(JSON.parse(row.payload) as T);
      } catch {
        // one malformed cached row shouldn't take down the whole read
      }
    }
    return result;
  } catch (err) {
    console.warn(`[offlineCache] Failed to read cache "${domain}":`, err);
    return [];
  }
}

export async function cacheClear(domain: string): Promise<void> {
  if (!isTauri) return;
  try {
    const db = await getDb();
    await db.execute("DELETE FROM cache_entities WHERE domain = ?", [domain]);
  } catch (err) {
    console.warn(`[offlineCache] Failed to clear cache "${domain}":`, err);
  }
}

// ─── Mutation queue ─────────────────────────────────────────────────────────

export interface QueuedMutation {
  id?: number;
  domain: string;
  method: string;
  payload: unknown;
  createdAt: number;
}

interface QueueRow {
  id: number;
  domain: string;
  method: string;
  payload: string;
  created_at: number;
  retries: number;
}

/** A write that failed while offline — queued to retry once back online. No-ops outside Tauri (the mutation is simply lost there, same as today). */
export async function enqueueMutation(m: Omit<QueuedMutation, "id" | "createdAt">): Promise<void> {
  if (!isTauri) return;
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO mutation_queue (domain, method, payload, created_at) VALUES (?, ?, ?, ?)",
      [m.domain, m.method, JSON.stringify(m.payload), Date.now()],
    );
  } catch (err) {
    console.warn(`[offlineCache] Failed to enqueue mutation "${m.method}":`, err);
  }
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  if (!isTauri) return [];
  try {
    const db = await getDb();
    const rows = await db.select<QueueRow[]>("SELECT * FROM mutation_queue ORDER BY created_at ASC");
    const result: QueuedMutation[] = [];
    for (const row of rows) {
      try {
        result.push({ id: row.id, domain: row.domain, method: row.method, payload: JSON.parse(row.payload), createdAt: row.created_at });
      } catch {
        // malformed queued row — skip it rather than crash the whole retry pass
      }
    }
    return result;
  } catch (err) {
    console.warn("[offlineCache] Failed to read mutation queue:", err);
    return [];
  }
}

export async function removeQueuedMutation(id: number): Promise<void> {
  if (!isTauri) return;
  try {
    const db = await getDb();
    await db.execute("DELETE FROM mutation_queue WHERE id = ?", [id]);
  } catch (err) {
    console.warn(`[offlineCache] Failed to remove queued mutation ${id}:`, err);
  }
}

type ReplayHandler = (payload: unknown) => Promise<void>;
const replayHandlers = new Map<string, ReplayHandler>();

/** Register once at module scope (same discipline as the `socket.on(...)` subscriptions elsewhere) — maps a queued mutation's `method` name back to the function that actually performs it. */
export function registerReplayHandler(method: string, handler: ReplayHandler): void {
  replayHandlers.set(method, handler);
}

/** Replays every queued mutation in order, removing each on success. Call whenever connectivity comes back. */
export async function retryQueuedMutations(): Promise<void> {
  if (!isTauri) return;
  const queued = await getQueuedMutations();
  for (const mutation of queued) {
    const handler = replayHandlers.get(mutation.method);
    if (!handler) {
      console.warn(`[offlineCache] No replay handler registered for "${mutation.method}", leaving queued`);
      continue;
    }
    try {
      await handler(mutation.payload);
      if (mutation.id !== undefined) await removeQueuedMutation(mutation.id);
    } catch (err) {
      console.warn(`[offlineCache] Retry failed for "${mutation.method}", will try again later:`, err);
    }
  }
}
