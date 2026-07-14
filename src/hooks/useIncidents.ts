import { useQuery } from "@tanstack/preact-query";
import { incidentsApi, type Incident } from "@/lib/api";
import { HAZARDS, type HazardData } from "@/lib/hazards";
import { socket } from "@/lib/socket";
import { queryClient } from "@/lib/queryClient";
import { cacheGetAll, cacheSet } from "@/lib/offlineCache";

// Registered once at module load (not per hook call, unlike an effect inside
// a component) — another client reporting an incident invalidates the cache
// instantly instead of waiting on the 30s poll below to catch up.
socket.on("incident-new", () => {
  void queryClient.invalidateQueries({ queryKey: ["incidents"] });
});

/**
 * Fetches live incidents from the backend.
 * Falls back to static HAZARDS constant if the API is unreachable.
 * The returned shape matches HazardData so existing components need zero changes.
 */
export function useIncidents() {
  return useQuery<HazardData[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      try {
        const data: Incident[] = await incidentsApi.list();
        const mapped: HazardData[] = data.map((inc) => ({
          id: inc.id,
          kind: inc.kind,
          label: inc.label,
          description: inc.description,
          severity: inc.severity,
          // Backend incidents don't have a static `time` — use reportedAt
          time: new Date(inc.reportedAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          offset: [inc.offsetLat, inc.offsetLon] as [number, number],
        }));
        void cacheSet("incidents", mapped);
        return mapped;
      } catch (err) {
        // placeholderData only covers the very first render before any fetch
        // resolves — it doesn't help on a *later* failure after a successful
        // fetch already happened in a prior app session. Fall back to the
        // SQLite cache (real, if stale, data) before giving up entirely.
        console.warn("[useIncidents] Fetch failed, trying SQLite cache:", err);
        const cached = await cacheGetAll<HazardData>("incidents");
        if (cached.length > 0) return cached;
        throw err;
      }
    },
    placeholderData: HAZARDS,
    staleTime: 1000 * 30, // 30s — incidents can be created any time
    refetchInterval: 1000 * 30, // auto-refresh every 30s
  });
}
