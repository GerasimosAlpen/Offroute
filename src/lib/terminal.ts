import { isTauri } from "@/lib/tauri";
import { getApiBaseUrl } from "@/lib/apiBase";
import { healthApi, adminApi } from "@/lib/api";
import { getQueuedMutations, retryQueuedMutations } from "@/lib/offlineCache";
import { socket } from "@/lib/socket";
import { useBluetoothStore } from "@/store/bluetooth";
import { useLocationStore } from "@/store/location";
import { useBmkgStore } from "@/store/bmkg";
import { usePresenceStore } from "@/store/presence";

/** One rendered block: the command that was run + its output lines. */
export interface TerminalLine {
  kind: "input" | "output" | "error" | "system";
  text: string;
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const NOT_TAURI =
  "⚠ Perintah sistem nyata butuh aplikasi desktop (Tauri).\n" +
  "  Di browser, perintah bawaan tetap jalan: help, status, health, queue, ble, reseed, report.";

const HELP = `Offroute Diagnostic Shell — perintah yang tersedia:

  SISTEM (butuh desktop/Tauri, baca-saja):
    uname [-a]        info kernel/OS
    uptime            lama sistem hidup
    whoami / id       identitas OS
    df [-h]           penggunaan disk
    vm_stat / free    memori
    ifconfig / ip a   antarmuka jaringan
    ping <host>       tes koneksi (auto -c 4)
    ps / top          proses
    date, hostname, arch, sw_vers, netstat ...

  BAWAAN (jalan di mana saja):
    help              tampilkan bantuan ini
    clear             bersihkan layar
    status            ringkasan semua parameter sistem
    health            cek API + database + latensi
    queue [flush]     antrean mutasi offline
    ble [scan|stop]   mesh Bluetooth
    api               alamat server backend
    whoami-app        peran & sesi aplikasi
    about             versi aplikasi

  KONTROL:
    reseed --yes      reset data mock ke kondisi awal (destruktif)
    report            tulis laporan diagnostik ke file
    restart           mulai ulang aplikasi (bukan reboot OS)
    quit              tutup aplikasi

Perintah destruktif butuh konfirmasi (mis. 'reseed --yes').`;

/** Runs one line, returns output lines. Never throws. `onClear` clears the screen. */
export async function runTerminalCommand(
  raw: string,
  helpers: { onClear: () => void },
): Promise<TerminalLine[]> {
  const input = raw.trim();
  if (!input) return [];
  const [cmd, ...args] = input.split(/\s+/);
  const out = (text: string, kind: TerminalLine["kind"] = "output"): TerminalLine[] => [{ kind, text }];

  switch (cmd) {
    case "help":
    case "?":
      return out(HELP);

    case "clear":
    case "cls":
      helpers.onClear();
      return [];

    case "about":
    case "version":
      return out(`Offroute v0.1.0 — Ranger Command / Field System\nRuntime: ${isTauri ? "Tauri desktop" : "browser (web)"}`);

    case "api":
      return out(getApiBaseUrl());

    case "whoami-app":
      return out(`peran: RADAR (Pusat Komando)\nruntime: ${isTauri ? "desktop" : "web"}\nsocket: ${socket.connected ? socket.id : "terputus"}`);

    case "status": {
      const bt = useBluetoothStore.getState();
      const loc = useLocationStore.getState();
      const bmkg = useBmkgStore.getState();
      const presence = Object.keys(usePresenceStore.getState().units).length;
      const queue = (await getQueuedMutations()).length;
      const h = await healthApi.ping();
      return out(
        [
          `API .............. ${h.ok ? "TERSAMBUNG" : "TERPUTUS"} (${h.latencyMs} ms)`,
          `Database ......... ${h.db ? "OK" : "TIDAK OK"}`,
          `WebSocket ........ ${socket.connected ? `LIVE (${socket.id})` : "TERPUTUS"}`,
          `Konektivitas ..... ${navigator.onLine ? "ONLINE" : "OFFLINE"}`,
          `Antrean offline .. ${queue}`,
          `Bluetooth ........ ${bt.scanning ? "MEMINDAI" : "SIAGA"}, ${bt.devices.length} perangkat, ${bt.devices.filter((d) => d.connected).length} terhubung`,
          `GPS .............. ${loc.status}${loc.coords ? ` (${loc.coords.lat.toFixed(4)}, ${loc.coords.lon.toFixed(4)})` : ""}`,
          `Feed BMKG ........ ${bmkg.status}`,
          `Unit daring ...... ${presence}`,
          `Server ........... ${getApiBaseUrl()}`,
        ].join("\n"),
      );
    }

    case "health": {
      const h = await healthApi.ping();
      return out(`API: ${h.ok ? "OK" : "GAGAL"} · DB: ${h.db ? "OK" : "GAGAL"} · latensi: ${h.latencyMs} ms`, h.ok && h.db ? "output" : "error");
    }

    case "queue": {
      if (args[0] === "flush") {
        const before = (await getQueuedMutations()).length;
        await retryQueuedMutations();
        const after = (await getQueuedMutations()).length;
        return out(`antrean: ${before} → ${after} (${before - after} terkirim)`);
      }
      const q = await getQueuedMutations();
      return out(q.length === 0 ? "antrean offline kosong" : `${q.length} mutasi tertunda:\n` + q.map((m) => `  · ${m.domain}/${m.method}`).join("\n"));
    }

    case "ble": {
      const bt = useBluetoothStore.getState();
      if (args[0] === "scan") {
        if (!isTauri) return out(NOT_TAURI, "system");
        try { await bt.startScan(); return out("pemindaian Bluetooth dimulai"); } catch { return out("gagal memindai (adapter tidak ada?)", "error"); }
      }
      if (args[0] === "stop") {
        if (!isTauri) return out(NOT_TAURI, "system");
        try { await bt.stopScan(); return out("pemindaian dihentikan"); } catch { return out("gagal", "error"); }
      }
      return out(bt.devices.length === 0 ? "tidak ada perangkat terlihat" : bt.devices.map((d) => `  ${d.connected ? "●" : "○"} ${d.name ?? d.id} ${d.rssi ?? ""}`).join("\n"));
    }

    case "reseed": {
      if (args[0] !== "--yes") {
        return out("⚠ Ini menghapus SEMUA data dan mengembalikan seed awal.\n  Jalankan 'reseed --yes' untuk melanjutkan.", "system");
      }
      try {
        const r = await adminApi.reseed();
        return out(`✓ Data direset. Personel: ${r.personnel}, Insiden: ${r.incidents}. Memuat ulang...`);
      } catch {
        return out("gagal mereset data — server tidak terjangkau?", "error");
      }
    }

    case "report": {
      const h = await healthApi.ping();
      const bt = useBluetoothStore.getState();
      const loc = useLocationStore.getState();
      const content =
        `OFFROUTE SYSTEM REPORT\n${new Date().toISOString()}\n\n` +
        `API ok=${h.ok} db=${h.db} latency=${h.latencyMs}ms\n` +
        `WebSocket connected=${socket.connected} id=${socket.id ?? "-"}\n` +
        `Online=${navigator.onLine}\n` +
        `Queue=${(await getQueuedMutations()).length}\n` +
        `Bluetooth scanning=${bt.scanning} devices=${bt.devices.length}\n` +
        `GPS=${loc.status} coords=${loc.coords ? `${loc.coords.lat},${loc.coords.lon}` : "-"}\n` +
        `Server=${getApiBaseUrl()}\n`;
      const fname = `offroute-report-${Date.now()}.txt`;
      if (isTauri) {
        try {
          const path = await invokeTauri<string>("write_report_file", { name: fname, content });
          return out(`✓ Laporan ditulis: ${path}`);
        } catch (e) {
          return out(`gagal menulis file: ${String(e)}`, "error");
        }
      }
      // Browser: still "make a file" — trigger a download.
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      return out(`✓ Laporan diunduh: ${fname}`);
    }

    case "restart":
      if (!isTauri) return out("⚠ Mulai-ulang aplikasi butuh desktop (Tauri). Di browser, muat ulang halaman saja.", "system");
      await invokeTauri("restart_app");
      return out("memulai ulang...");

    case "quit":
    case "exit":
      if (!isTauri) return out("⚠ Tutup aplikasi butuh desktop (Tauri).", "system");
      await invokeTauri("quit_app");
      return out("menutup...");

    case "echo":
      return out(args.join(" "));

    default: {
      // Anything else → a real OS command via Tauri (allowlisted, read-only).
      if (!isTauri) return out(NOT_TAURI, "system");
      try {
        const result = await invokeTauri<string>("run_system_command", { input });
        return out(result);
      } catch (e) {
        return out(String(e), "error");
      }
    }
  }
}
