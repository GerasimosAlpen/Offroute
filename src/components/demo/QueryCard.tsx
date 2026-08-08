import { useQuery } from "@tanstack/preact-query";
import axios from "axios";
import { RefreshCw, Loader2 } from "lucide-preact";
import { Card } from "./Card";
import { primaryBtn } from "./styles";
import { getApiBaseUrl } from "@/lib/apiBase";

export function QueryCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["nestjs-health"],
    queryFn: () => axios.get(getApiBaseUrl()).then((r) => r.data),
    enabled: false,
    retry: false,
  });

  return (
    <Card
      icon={<RefreshCw size={14} />}
      title="TanStack Query"
      badge="preact"
      badgeColor="text-sky-400 border-sky-500/30 bg-sky-500/10"
      delay={0.25}
    >
      <p class="text-xs text-zinc-500">
        Server state + caching. Pings the backend at <code class="text-zinc-400">{getApiBaseUrl()}</code>.
      </p>
      <button
        class={`${primaryBtn} flex items-center gap-1.5`}
        onClick={() => refetch()}
        disabled={isFetching}
      >
        {isFetching ? <Loader2 size={12} class="animate-spin" /> : <RefreshCw size={12} />}
        Fetch
      </button>
      {isLoading && <p class="text-xs text-zinc-500">loading…</p>}
      {isError && (
        <p class="text-xs font-mono text-red-400 truncate">
          {(error as Error).message}
        </p>
      )}
      {data && (
        <pre class="text-xs font-mono text-emerald-400 bg-zinc-800 rounded-lg p-2 overflow-auto max-h-20">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </Card>
  );
}
