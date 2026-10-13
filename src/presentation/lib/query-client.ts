import { QueryClient } from "@tanstack/react-query";

/**
 * Shared React Query defaults for the web shell.
 *
 * Public catalog data (centers, services, categories) is read-mostly, so a
 * one-minute `staleTime` avoids redundant refetches while keeping the landing
 * content reasonably fresh. Window-focus refetching is disabled because the
 * marketing pages should not silently re-render behind the user; mutations
 * never retry so a failed submit surfaces immediately to the form.
 */
export const DEFAULT_STALE_TIME = 60_000;
export const DEFAULT_GC_TIME = 5 * 60_000;
export const DEFAULT_QUERY_RETRY = 1;

/** Builds an isolated client. Tests create their own to avoid cache bleed. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        retry: DEFAULT_QUERY_RETRY,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** Application-wide client consumed by `QueryClientProvider` in `main.tsx`. */
export const queryClient: QueryClient = createQueryClient();
