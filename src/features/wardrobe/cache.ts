import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { WardrobeItem, WardrobeItemPage, WardrobeItemSummary } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { toNumber } from '@/utils/money';

type ItemsData = InfiniteData<WardrobeItemPage, number>;
type ItemFilters = { category?: string; color?: string };

/** The list row of a full item: what the grid shows. */
export function toSummary(item: WardrobeItem): WardrobeItemSummary {
  return {
    id: item.id,
    status: item.status,
    name: item.name,
    categorySlug: item.category?.slug ?? null,
    needsCategory: item.needsCategory,
    primaryColor: item.primaryColor,
    thumbUrl: item.thumbUrl,
    wearCount: item.wearCount,
    lastWornAt: item.lastWornAt,
    isArchived: item.isArchived,
    createdAt: item.createdAt,
  };
}

/**
 * Applies `change` to every cached item list. The list keys carry the filters (`['wardrobe', 'items', filters]`), so
 * a change can target only the unfiltered lists (a new card whose category is not known yet).
 */
function updateLists(
  queryClient: QueryClient,
  change: (items: WardrobeItemSummary[], filters: ItemFilters) => WardrobeItemSummary[],
): void {
  for (const [key, data] of queryClient.getQueriesData<ItemsData>({
    queryKey: queryKeys.wardrobeItemsAll,
  })) {
    if (!data) {
      continue;
    }
    const filters = (key[2] ?? {}) as ItemFilters;
    const pages = data.pages.map((page) => {
      const items = change(page.items, filters);
      return items === page.items
        ? page
        : {
            ...page,
            items,
            totalCount: toNumber(page.totalCount) + items.length - page.items.length,
          };
    });
    queryClient.setQueryData<ItemsData>(key, { ...data, pages });
  }
}

/** Puts a card at the top of every unfiltered list; filtered lists get it when the list is refetched. */
export function prependItem(queryClient: QueryClient, summary: WardrobeItemSummary): void {
  for (const [key, data] of queryClient.getQueriesData<ItemsData>({
    queryKey: queryKeys.wardrobeItemsAll,
  })) {
    const filters = (key[2] ?? {}) as ItemFilters;
    const first = data?.pages[0];
    if (!data || !first || filters.category || filters.color) {
      continue;
    }
    const rest = first.items.filter((item) => item.id !== summary.id);
    queryClient.setQueryData<ItemsData>(key, {
      ...data,
      pages: [
        {
          ...first,
          items: [summary, ...rest],
          totalCount: toNumber(first.totalCount) + (rest.length === first.items.length ? 1 : 0),
        },
        ...data.pages.slice(1),
      ],
    });
  }
}

/** Replaces the card `id` with `summary` (which may carry a new id: a local card gets its server id). */
export function replaceItem(
  queryClient: QueryClient,
  id: string,
  summary: WardrobeItemSummary,
): void {
  updateLists(queryClient, (items) =>
    items.some((item) => item.id === id)
      ? items.map((item) => (item.id === id ? summary : item))
      : items,
  );
}

export function patchItem(
  queryClient: QueryClient,
  id: string,
  patch: Partial<WardrobeItemSummary>,
): void {
  updateLists(queryClient, (items) =>
    items.some((item) => item.id === id)
      ? items.map((item) => (item.id === id ? { ...item, ...patch } : item))
      : items,
  );
}

export function removeItem(queryClient: QueryClient, id: string): void {
  updateLists(queryClient, (items) =>
    items.some((item) => item.id === id) ? items.filter((item) => item.id !== id) : items,
  );
}

/** Everything derived from the wardrobe (lists, stats, gaps) and every outfit made from it is stale after a change. */
export function invalidateWardrobe(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.outfitsAll }),
  ]).then(() => undefined);
}
