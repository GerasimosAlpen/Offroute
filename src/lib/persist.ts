import { load, type Store } from "@tauri-apps/plugin-store";
import { isTauri } from "./tauri";

const STORE_FILE = "ranger-settings.json";
let storePromise: Promise<Store> | null = null;

function getStore() {
  if (!storePromise) storePromise = load(STORE_FILE, { defaults: {} });
  return storePromise;
}

/**
 * Reads real disk-backed storage in Tauri (tauri-plugin-store — an actual
 * file next to the app's data dir), falling back to localStorage in plain
 * browser dev. Both sides speak JSON so callers don't need to care which
 * backend they're on. Always async, even for the localStorage path, so
 * callers don't build assumptions around one backend being synchronous.
 */
export async function getPersisted<T>(key: string): Promise<T | null> {
  if (isTauri) {
    const store = await getStore();
    const value = await store.get<T>(key);
    return value ?? null;
  }

  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setPersisted<T>(key: string, value: T): Promise<void> {
  if (isTauri) {
    const store = await getStore();
    await store.set(key, value);
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}
