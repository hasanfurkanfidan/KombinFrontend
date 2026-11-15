import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Pull-to-refresh for a paged list. A plain `refetch()` of an infinite query asks for every page loaded so far, one
 * after another (40 requests after scrolling 40 pages). The list is first cut back to its first page, so a refresh is
 * one request and the user scrolls on from there; the old first page stays on screen until the new one arrives.
 */
export async function refetchFromFirstPage(
  queryClient: QueryClient,
  queryKey: QueryKey,
): Promise<void> {
  queryClient.setQueryData<InfiniteData<unknown, unknown>>(queryKey, (data) =>
    data && data.pages.length > 1
      ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
      : data,
  );
  await queryClient.refetchQueries({ queryKey, exact: true });
}
