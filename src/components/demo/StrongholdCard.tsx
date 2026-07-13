import { useRef, useState } from "preact/hooks";
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";
import { Lock } from "lucide-preact";
import { isTauri } from "@/lib/tauri";
import { Card } from "./Card";
import { btn, ghostBtn } from "./styles";

export function StrongholdCard() {
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
