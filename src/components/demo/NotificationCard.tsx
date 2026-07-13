import { useState } from "preact/hooks";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Bell } from "lucide-preact";
import { isTauri } from "@/lib/tauri";
import { Card } from "./Card";
import { primaryBtn } from "./styles";

export function NotificationCard() {
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
