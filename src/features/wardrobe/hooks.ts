import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { listProducts } from '@/api/endpoints/catalog';
import { useCategories } from '@/features/catalog/hooks';
import {
  archiveWardrobeItem,
  getWardrobeGaps,
  getWardrobeItem,
  getWardrobeStats,
  listWardrobeItems,
  recordWear,
  undoWear,
  updateWardrobeItem,
} from '@/api/endpoints/wardrobe';
import type { CategoryNode, UpdateWardrobeItemRequest, WardrobeItem } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';
import { toNumber } from '@/utils/money';

import { invalidateWardrobe, patchItem, removeItem, toSummary, replaceItem } from './cache';

export const ITEMS_PAGE_SIZE = 24;

export interface ItemFilters {
  category?: string;
  color?: string;
}

export function useWardrobeItems(filters: ItemFilters) {
  const { isSignedIn } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.wardrobeItems(filters),
    queryFn: ({ pageParam, signal }) =>
      listWardrobeItems({ ...filters, page: pageParam, pageSize: ITEMS_PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const page = toNumber(last.page);
      const totalPages = Math.ceil(toNumber(last.totalCount) / toNumber(last.pageSize));
      return page < totalPages ? page + 1 : undefined;
    },
    enabled: isSignedIn,
  });
}

/** Counts for the stats row and the home card's gate; the outfit count is `null` until the backend has it. */
export function useWardrobeStats() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.wardrobeStats,
    queryFn: ({ signal }) => getWardrobeStats(signal),
    enabled: isSignedIn,
  });
}

export function useWardrobeGaps() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.wardrobeGaps,
    queryFn: ({ signal }) => getWardrobeGaps(signal),
    enabled: isSignedIn,
  });
}

export function useWardrobeItem(id: string | undefined) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.wardrobeItem(id ?? ''),
    queryFn: ({ signal }) => getWardrobeItem(id ?? '', signal),
    enabled: isSignedIn && Boolean(id),
  });
}

/** Writes a changed item into the detail cache and the grid, then refreshes what derives from the wardrobe. */
function applyItem(queryClient: QueryClient, item: WardrobeItem): void {
  queryClient.setQueryData(queryKeys.wardrobeItem(item.id), item);
  replaceItem(queryClient, item.id, toSummary(item));
  void invalidateWardrobe(queryClient);
}

/** `PATCH {}` is the confirmation of a ready item; any other field edits it. */
export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<UpdateWardrobeItemRequest> }) =>
      updateWardrobeItem(id, patch),
    onSuccess: (item) => applyItem(queryClient, item),
  });
}

export function useArchiveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveWardrobeItem(id),
    onSuccess: (_result, id) => {
      removeItem(queryClient, id);
      queryClient.removeQueries({ queryKey: queryKeys.wardrobeItem(id) });
      void invalidateWardrobe(queryClient);
    },
  });
}

function applyWear(
  queryClient: QueryClient,
  wear: { itemId: string; wearCount: number | string; lastWornAt: string | null },
): void {
  const patch = { wearCount: wear.wearCount, lastWornAt: wear.lastWornAt };
  patchItem(queryClient, wear.itemId, patch);
  queryClient.setQueryData<WardrobeItem>(queryKeys.wardrobeItem(wear.itemId), (item) =>
    item ? { ...item, ...patch } : item,
  );
  void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeStats });
}

export function useWearItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordWear(id),
    onSuccess: (wear) => applyWear(queryClient, wear),
  });
}

export function useUndoWear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, wornOn }: { id: string; wornOn: string }) => undoWear(id, wornOn),
    onSuccess: (wear) => applyWear(queryClient, wear),
  });
}

/** Product search for "Kataloğdan ekle"; an empty query lists the catalog's default order. */
export function useCatalogSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['catalog', 'search', trimmed] as const,
    queryFn: ({ signal }) =>
      listProducts({ Query: trimmed || undefined, Page: 1, PageSize: 20 }, signal),
    select: (data) => data.items,
    staleTime: 60_000,
  });
}

function findCategory(nodes: readonly CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) {
      return node;
    }
    const found = findCategory(node.children, slug);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** `ust-giyim/blazer` -> "Blazer" from the catalog tree; the slug's last segment while the tree is loading. */
export function useCategoryName(slug: string | null | undefined): string | null {
  const categories = useCategories();
  if (!slug) {
    return null;
  }
  return findCategory(categories.data ?? [], slug)?.name ?? slug.split('/').pop() ?? slug;
}
