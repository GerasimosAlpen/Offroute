import { QueryClient } from "@tanstack/preact-query";

/**
 * Shared TanStack Query client — its own module (not defined inline in
 * main.tsx) so anything that needs to invalidate/read the cache (e.g. a
 * realtime socket listener reacting to a backend push) can import it
 * without creating a circular dependency back through the app's entry point.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
