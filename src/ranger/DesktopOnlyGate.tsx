import type { ComponentChildren } from "preact";

/**
 * Radar is fully responsive now (mobile bottom-nav shell, single-pane map),
 * so this gate no longer blocks anything. It stays exported for call sites
 * that were written against it and would otherwise need an edit — pass-through.
 */
export function DesktopOnlyGate({ children }: { children: ComponentChildren }) {
  return <>{children}</>;
}
