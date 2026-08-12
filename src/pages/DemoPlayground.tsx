import { Link } from "wouter";
import { isTauri } from "@/lib/tauri";
import { TauriCard } from "@/components/demo/TauriCard";
import { NotificationCard } from "@/components/demo/NotificationCard";
import { SQLiteCard } from "@/components/demo/SQLiteCard";

import { ZustandCard } from "@/components/demo/ZustandCard";
import { QueryCard } from "@/components/demo/QueryCard";
import { ValibotCard } from "@/components/demo/ValibotCard";
import { EffectCard } from "@/components/demo/EffectCard";
import { FramerCard } from "@/components/demo/FramerCard";
import { TailwindCard } from "@/components/demo/TailwindCard";
import { LucideCard } from "@/components/demo/LucideCard";
import { MapCard } from "@/components/demo/MapCard";
import { RealtimeCard } from "@/components/demo/RealtimeCard";
import { BluetoothCard } from "@/components/demo/BluetoothCard";

const stack = [
  "Tauri v2", "Preact", "TypeScript", "Vite 6",
  "Tailwind v4", "Zustand v5", "TanStack Query",
  "Axios", "Valibot", "Effect-TS", "Framer Motion",
  "Lucide", "SQLite", "Stronghold", "NestJS", "React Leaflet", "Bluetooth",
];

export default function DemoPlayground() {
  return (
    <div class="min-h-dvh bg-zinc-950 text-zinc-100">
      {/* header */}
      <header class="border-b border-zinc-800/60 px-6 py-4">
        <div class="max-w-5xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Link
              href="/ranger/radar"
              class="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Ranger → radar console
            </Link>
            <Link
              href="/ranger/personel"
              class="text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              Personel → mobile app
            </Link>
            <Link
              href="/user"
              class="text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              User → warga app
            </Link>
            <div class="hidden sm:flex gap-1.5 flex-wrap justify-end max-w-sm">
              {stack.map((s) => (
                <span key={s} class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-500 border border-zinc-700/50">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* grid */}
      <main class="max-w-5xl mx-auto px-6 py-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TauriCard />
          <NotificationCard />
          <SQLiteCard />

          <ZustandCard />
          <QueryCard />
          <ValibotCard />
          <EffectCard />
          <FramerCard />
          <TailwindCard />
          <LucideCard />
          <MapCard />
          <RealtimeCard />
          <BluetoothCard />
        </div>
      </main>
    </div>
  );
}
