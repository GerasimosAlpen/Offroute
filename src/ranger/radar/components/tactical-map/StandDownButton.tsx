import { ShieldOff } from "lucide-preact";
import { useFlareStore } from "@/store/flare";

/**
 * Manual FLARE stand-down — only rendered while a FLARE is actually active.
 * Styled deliberately neutral (not red) so it doesn't read as "trigger it
 * again" next to the actual FLARE trigger control elsewhere in the UI.
 */
export function StandDownButton() {
  const active = useFlareStore((s) => s.active);
  if (!active) return null;

  return (
    <button
      type="button"
      onClick={() => void useFlareStore.getState().deactivate()}
      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#8a8a8a] text-[#e5e2e1] text-[11px] tracking-[0.5px] uppercase hover:border-[#ffb2bd] hover:text-[#ffb2bd] transition-colors"
    >
      <ShieldOff size={12} />
      Stand Down
    </button>
  );
}
