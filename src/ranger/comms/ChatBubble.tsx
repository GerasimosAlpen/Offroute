import { Radio, User } from "lucide-preact";
import type { CommEntry } from "@/store/commsLog";
import { useDecryptReveal } from "./useDecryptReveal";

const COMMAND_SENDERS = new Set(["PUSAT", "SISTEM"]);

/**
 * Personel's chat-bubble rendering of a comm entry — same shared channel and
 * decrypt animation as radar's `CommMessage`, but styled so a unit can tell
 * at a glance who sent what: themself (right, pink), radar/command (left,
 * red, radio badge), or another personel unit (left, green, person badge).
 */
export function ChatBubble({
  entry,
  animate = false,
  selfLabel,
}: {
  entry: CommEntry;
  animate?: boolean;
  selfLabel: string;
}) {
  const { displayBody, revealed } = useDecryptReveal(entry.body, animate);
  const isSelf = entry.sender === selfLabel;
  const isCommand = COMMAND_SENDERS.has(entry.sender);

  return (
    <div className={`flex flex-col max-w-[85%] ${isSelf ? "items-end self-end" : "items-start"}`}>
      {!isSelf && (
        <span
          className="font-mono text-[10px] mb-1 flex items-center gap-1 uppercase"
          style={{ color: entry.color }}
        >
          {isCommand ? <Radio size={10} /> : <User size={10} />}
          {entry.sender} · {entry.time}
        </span>
      )}
      {isSelf && (
        <span className="font-mono text-[10px] mb-1 text-[#ffb2bd]">{entry.time}</span>
      )}
      <div
        className={`px-4 py-2.5 ${
          isSelf
            ? "bg-[#353535] border border-[#a8898c]"
            : isCommand
              ? "bg-[#93000a]/15 border border-[#FF0040]/50"
              : "bg-[#1a2e20] border border-[#66df75]/50"
        }`}
      >
        <p
          className={`text-sm ${
            revealed ? "text-[#e5e2e1]" : "font-mono tracking-wider text-[#66df75]"
          }`}
        >
          {displayBody}
        </p>
      </div>
    </div>
  );
}
