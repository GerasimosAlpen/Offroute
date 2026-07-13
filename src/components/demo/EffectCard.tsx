import { useState } from "preact/hooks";
import { Effect } from "effect";
import { Sparkles } from "lucide-preact";
import { Card } from "./Card";
import { btn } from "./styles";

export function EffectCard() {
  const [output, setOutput] = useState<string | null>(null);

  function run() {
    const program = Effect.succeed({ user: "offroute", ts: Date.now() }).pipe(
      Effect.map((data) => ({ ...data, processed: true })),
      Effect.flatMap((data) =>
        data.processed
          ? Effect.succeed(data)
          : Effect.fail(new Error("not processed")),
      ),
    );

    Effect.runPromise(program)
      .then((r) => setOutput(JSON.stringify(r)))
      .catch((e) => setOutput(`Error: ${e.message}`));
  }

  return (
    <Card
      icon={<Sparkles size={14} />}
      title="Effect-TS"
      badge="fp"
      badgeColor="text-violet-400 border-violet-500/30 bg-violet-500/10"
      delay={0.35}
    >
      <p class="text-xs text-zinc-500">Typed effects, composable error handling.</p>
      <button class={`${btn} bg-violet-700 hover:bg-violet-600 text-white`} onClick={run}>
        Run effect
      </button>
      {output && (
        <pre class="text-xs font-mono text-violet-300 bg-zinc-800 rounded-lg p-2 overflow-auto">
          {output}
        </pre>
      )}
    </Card>
  );
}
