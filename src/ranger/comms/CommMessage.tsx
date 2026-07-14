import type { CommEntry } from "@/store/commsLog";
import { useDecryptReveal } from "./useDecryptReveal";

/**
 * One Comm Center log line (radar's terminal-style dispatch console). Shares
 * its encrypt/decrypt reveal animation with personel's `ChatBubble` via
 * `useDecryptReveal` — same effect, different presentation per screen.
 */
export function CommMessage({ entry, animate = false }: { entry: CommEntry; animate?: boolean }) {
  const { displayBody, revealed } = useDecryptReveal(entry.body, animate);

  return (
    <p className="leading-5">
      <span className="text-[#ffb2bd]">[{entry.time}]</span>{" "}
      <span style={{ color: entry.color }} className="uppercase">
        {entry.sender}: {entry.lead}
      </span>{" "}
      <span className={revealed ? "text-[#e1bec2]" : "font-mono tracking-wider text-[#66df75]"}>
        {displayBody}
      </span>
    </p>
  );
}
