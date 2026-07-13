import { useState } from "preact/hooks";
import * as v from "valibot";
import { ShieldCheck, CheckCircle2, XCircle } from "lucide-preact";
import { Card } from "./Card";
import { btn } from "./styles";

const emailSchema = v.object({
  email: v.pipe(v.string(), v.email("Invalid email")),
  name: v.pipe(v.string(), v.minLength(2, "Min 2 chars")),
});

export function ValibotCard() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [valid, setValid] = useState<boolean | null>(null);

  function validate() {
    const result = v.safeParse(emailSchema, { email, name });
    if (result.success) {
      setErrors({});
      setValid(true);
    } else {
      const map: Record<string, string> = {};
      for (const issue of result.issues) {
        const key = String(issue.path?.[0]?.key ?? "field");
        map[key] = issue.message;
      }
      setErrors(map);
      setValid(false);
    }
  }

  return (
    <Card
      icon={<ShieldCheck size={14} />}
      title="Valibot"
      badge="validation"
      badgeColor="text-lime-400 border-lime-500/30 bg-lime-500/10"
      delay={0.3}
    >
      <p class="text-xs text-zinc-500">Schema validation — typesafe, tree-shakeable.</p>
      <div class="space-y-2">
        <div>
          <input
            class={`w-full bg-zinc-800 border rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors ${errors.name ? "border-red-500 focus:border-red-400" : "border-zinc-700 focus:border-lime-500"}`}
            placeholder="name"
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          {errors.name && <p class="text-[10px] text-red-400 mt-0.5 ml-1">{errors.name}</p>}
        </div>
        <div>
          <input
            class={`w-full bg-zinc-800 border rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors ${errors.email ? "border-red-500 focus:border-red-400" : "border-zinc-700 focus:border-lime-500"}`}
            placeholder="email"
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
          {errors.email && <p class="text-[10px] text-red-400 mt-0.5 ml-1">{errors.email}</p>}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class={`${btn} bg-lime-700 hover:bg-lime-600 text-white`} onClick={validate}>
          Validate
        </button>
        {valid === true && <CheckCircle2 size={14} class="text-emerald-400" />}
        {valid === false && <XCircle size={14} class="text-red-400" />}
      </div>
    </Card>
  );
}
