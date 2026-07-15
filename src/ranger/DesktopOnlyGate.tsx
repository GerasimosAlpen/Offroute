import type { ComponentChildren } from "preact";
import { MonitorSmartphone } from "lucide-preact";
import { useIsDesktop } from "./platform";

export function DesktopOnlyGate({ children }: { children: ComponentChildren }) {
  const isDesktop = useIsDesktop();

  if (isDesktop) return <>{children}</>;

  return (
    <div class="min-h-dvh bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
      <div class="max-w-sm text-center flex flex-col items-center gap-3">
        <MonitorSmartphone size={32} class="text-zinc-500" />
        <h1 class="text-sm font-semibold text-white">Desktop only</h1>
        <p class="text-xs text-zinc-500">
          Ranger is a desktop console. Open it on a desktop build of Offroute
          to continue.
        </p>
      </div>
    </div>
  );
}
