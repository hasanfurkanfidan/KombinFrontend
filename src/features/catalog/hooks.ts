import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getPriceHistory, getProduct, listCategories, listProducts } from '@/api/endpoints/catalog';
import { queryKeys } from '@/api/queryKeys';
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

export function useProducts(filters: ProductFilters) {
  return useInfiniteQuery({
    // The page number is not part of the key: all pages of one filter set live in one cache entry.
    queryKey: queryKeys.products(toListQuery(filters)),
    queryFn: ({ pageParam, signal }) => listProducts(toListQuery(filters, pageParam), signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const page = toNumber(lastPage.page);
      const totalPages = Math.ceil(toNumber(lastPage.totalCount) / toNumber(lastPage.pageSize));
      return page < totalPages ? page + 1 : undefined;
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: ({ signal }) => getProduct(id, signal),
  });
}

/** Independent of `useProduct`: the two requests run in parallel and the page renders on the first. */
export function usePriceHistory(id: string) {
  return useQuery({
    queryKey: queryKeys.priceHistory(id, PRICE_HISTORY_DAYS),
    queryFn: ({ signal }) => getPriceHistory(id, PRICE_HISTORY_DAYS, signal),
  });
}
