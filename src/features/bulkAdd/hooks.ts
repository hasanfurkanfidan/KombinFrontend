import { useQuery, type QueryClient } from '@tanstack/react-query';

import { getBulkBatch, probeBulkAvailable } from '@/api/endpoints/bulkAdd';
import type { BulkBatch } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

import { POLL_INTERVAL_MS, msUntilUrlRefresh, pollBackoffMs, pollErrorKind } from './flow';

/** The server's switch is a state of its configuration: asked once, kept 10 minutes (like the league's `null`). */
const AVAILABLE_STALE_MS = 10 * 60_000;

/** `true` only when the server has bulk add switched on. Visitors never ask (the routes need a token). */
export function useBulkAvailable(): boolean {
  const { isSignedIn } = useSession();
  const query = useQuery({
    queryKey: queryKeys.bulkAvailable,
    queryFn: ({ signal }) => probeBulkAvailable(signal),
    enabled: isSignedIn,
    staleTime: AVAILABLE_STALE_MS,
    retry: false,
  });
  return isSignedIn && query.data === true;
}

/** A route answered `Wardrobe.BulkDisabled`: the entry disappears at once, with no error. */
export function markBulkUnavailable(queryClient: QueryClient): void {
  queryClient.setQueryData(queryKeys.bulkAvailable, false);
}

function isWaiting(batch: BulkBatch | undefined): boolean {
  return !batch || batch.status === 'Created' || batch.status === 'Processing';
}

/**
 * The status answer of one batch: polled every second while the server separates the pieces (unless `paused`, after
 * the wait limit; a 429 backs off, any other 4xx stops it), then asked again only to refresh the picture links before they expire. Never kept after the
 * screen leaves (`gcTime: 0`): the links are private and an hour long.
 */
export function useBulkBatch(id: string | null, paused: boolean) {
  return useQuery({
    queryKey: queryKeys.bulkBatch(id ?? ''),
    queryFn: ({ signal }) => getBulkBatch(id ?? '', signal),
    enabled: id !== null,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      // A refused poll: a 429 waits and keeps the batch, any other 4xx ends the polling for good.
      const failure = pollErrorKind(query.state.error);
      if (failure === 'stop') return false;
      if (failure === 'backoff') return paused ? false : pollBackoffMs(query.state.error);
      const batch = query.state.data;
      if (isWaiting(batch)) {
        return paused ? false : POLL_INTERVAL_MS;
      }
      return batch?.status === 'Ready' ? (msUntilUrlRefresh(batch, Date.now()) ?? false) : false;
    },
  });
}
