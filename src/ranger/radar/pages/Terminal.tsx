import { useEffect, useRef, useState } from "preact/hooks";
import { isTauri } from "@/lib/tauri";
import { runTerminalCommand, type TerminalLine } from "@/lib/terminal";

const PROMPT = "radar@offroute:~$";

const BANNER: TerminalLine[] = [
  { kind: "system", text: "Offroute Diagnostic Shell — Ranger Command" },
  { kind: "system", text: isTauri ? "runtime: Tauri desktop · perintah sistem nyata aktif" : "runtime: browser · perintah sistem butuh aplikasi desktop" },
  { kind: "system", text: "ketik 'help' untuk daftar perintah, 'clear' untuk bersihkan layar." },
  { kind: "output", text: "" },
];

const LINE_COLOR: Record<TerminalLine["kind"], string> = {
  input: "#e5e2e1",
  output: "#a8b3a8",
  error: "#ff6b81",
  system: "#5fb3b3",
};

/**
 * A Linux-style diagnostics terminal. Real allowlisted system commands run
 * via Tauri (uname, df, ping, …); built-ins (help, status, health, queue,
 * ble, reseed, report, restart) run anywhere. Outside Tauri, system commands
 * report a friendly notice instead of erroring. Feels like a real shell:
 * prompt, blinking block cursor, and up/down command history.
 */
export function Terminal() {
  const [lines, setLines] = useState<TerminalLine[]>(BANNER);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const focusInput = () => inputRef.current?.focus();
  useEffect(() => { focusInput(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines, running]);

  const submit = async () => {
    const cmd = input;
    setInput("");
    setHistIdx(null);
    if (cmd.trim()) setHistory((h) => [...h, cmd]);
    // Echo the prompt line exactly like a real shell.
    setLines((l) => [...l, { kind: "input", text: `${PROMPT} ${cmd}` }]);
    if (!cmd.trim()) return;

    setRunning(true);
    const result = await runTerminalCommand(cmd, { onClear: () => setLines([]) });
    setRunning(false);
    if (result.length) setLines((l) => [...l, ...result]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!running) void submit();
      return;
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(history[next]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const next = histIdx + 1;
      if (next >= history.length) {
        setHistIdx(null);
        setInput("");
      } else {
        setHistIdx(next);
        setInput(history[next]);
      }
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 bg-[#0a0a0a] flex flex-col" onClick={focusInput}>
      <div className="shrink-0 h-8 flex items-center gap-2 px-4 bg-[#131313] border-b border-[#333]">
        <span className="size-2.5 rounded-full bg-[#ff5f56]" />
        <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="size-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 font-mono text-[11px] text-[#888] tracking-wide">offroute — diagnostic shell</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed">
        {lines.map((line, i) => (
          <pre key={i} className="whitespace-pre-wrap break-words m-0" style={{ color: LINE_COLOR[line.kind] }}>
            {line.text}
          </pre>
        ))}

        {/* Current prompt line with a blinking block cursor. */}
        {!running && (
          <div className="flex items-baseline">
            <span className="text-[#66df75] shrink-0">{PROMPT}&nbsp;</span>
            <span className="text-[#e5e2e1] whitespace-pre-wrap break-words">{input}</span>
            <span className="inline-block w-[7px] h-[15px] bg-[#66df75] ml-px translate-y-[2px] animate-pulse" />
          </div>
        )}
        {running && <pre className="m-0 text-[#666]">…</pre>}
        <div ref={endRef} />
      </div>

      {/* Off-screen real input captures keystrokes; the block cursor above is
          the visible affordance, so it reads like a native terminal. */}
      <input
        ref={inputRef}
        value={input}
        onInput={(e) => setInput((e.target as HTMLInputElement).value)}
        onKeyDown={onKeyDown}
        spellcheck={false}
        autocapitalize="off"
        autocomplete="off"
        className="absolute opacity-0 -z-10 w-0 h-0"
        aria-label="Terminal input"
      />
    </div>
  );
}
