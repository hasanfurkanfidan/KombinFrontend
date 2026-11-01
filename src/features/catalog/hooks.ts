import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query';

import { getPriceHistory, getProduct, listCategories, listProducts } from '@/api/endpoints/catalog';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';
import { toNumber } from '@/utils/money';

import { toListQuery, type ProductFilters } from './filters';

export const PRICE_HISTORY_DAYS = 90;

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: 10 * 60_000,
  });
}

function nextPage(lastPage: {
  page: number | string;
  pageSize: number | string;
  totalCount: number | string;
}) {
  const page = toNumber(lastPage.page);
  const totalPages = Math.ceil(toNumber(lastPage.totalCount) / toNumber(lastPage.pageSize));
  return page < totalPages ? page + 1 : undefined;
}

/** `enabled` lets the screen wait until the active persona is known, so the list is fetched once. */
export function useProducts(filters: ProductFilters, enabled = true) {
  return useInfiniteQuery({
    // The page number is not part of the key: all pages of one filter set live in one cache entry.
    queryKey: queryKeys.products(toListQuery(filters)),
    queryFn: ({ pageParam, signal }) => listProducts(toListQuery(filters, pageParam), signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled,
  });
}

/** Warms the first page of a product list (used after onboarding so Keşfet opens instantly). */
export function prefetchProducts(queryClient: QueryClient, filters: ProductFilters) {
  return queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.products(toListQuery(filters)),
    queryFn: ({ pageParam, signal }) => listProducts(toListQuery(filters, pageParam), signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    pages: 1,
  });
}

/**
 * Product detail. A signed-in caller sends the token (the size hint is personal) and the active persona
 * (`matchScore`); a logged-out one fetches the public view.
 */
export function useProduct(id: string, personaId?: string, enabled = true) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.product(id, personaId),
    queryFn: ({ signal }) => getProduct(id, { personaId, auth: isSignedIn }, signal),
    enabled,
  });
}

/** Independent of `useProduct`: the two requests run in parallel and the page renders on the first. */
export function usePriceHistory(id: string) {
  return useQuery({
    queryKey: queryKeys.priceHistory(id, PRICE_HISTORY_DAYS),
    queryFn: ({ signal }) => getPriceHistory(id, PRICE_HISTORY_DAYS, signal),
  });
}
