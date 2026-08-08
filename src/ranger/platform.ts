import { useEffect, useState } from "preact/hooks";
import { isTauri } from "@/lib/tauri";

const MOBILE_OS = new Set(["ios", "android"]);
const MOBILE_VIEWPORT_BREAKPOINT = 768;

/**
 * Ranger is desktop-only (see src/ranger/README.md). On Tauri, OS type is
 * authoritative and known synchronously at plugin init. In a plain browser
 * (dev/preview, no Tauri runtime) we fall back to viewport width so the
 * gate still behaves sensibly.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (isTauri) {
      const internals = (window as any).__TAURI_OS_PLUGIN_INTERNALS__;
      return internals ? !MOBILE_OS.has(internals.os_type) : true;
    }
    return window.innerWidth >= MOBILE_VIEWPORT_BREAKPOINT;
  });

  useEffect(() => {
    if (isTauri) return;
    const onResize = () =>
      setIsDesktop(window.innerWidth >= MOBILE_VIEWPORT_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isDesktop;
}

/** Inverse of useIsDesktop — mobile OS or narrow viewport. */
export function useIsMobile(): boolean {
  return !useIsDesktop();
}
