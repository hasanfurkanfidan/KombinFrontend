import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { searchBrands } from '@/api/endpoints/catalog';
import { listSizes, upsertSize } from '@/api/endpoints/profile';
import type { UpsertSizeRequest } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

export function useSizes() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.sizes,
    queryFn: ({ signal }) => listSizes(signal),
    enabled: isSignedIn,
    select: (data) => data.items,
  });
}

export function useUpsertSize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertSizeRequest) => upsertSize(body),
    onSuccess: async () => {
      // A new size changes the hint shown on every product detail.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sizes }),
        queryClient.invalidateQueries({ queryKey: ['catalog', 'product'] }),
      ]);
    },
  });
}

/** Brand search for the size sheet; waits for at least one character. */
export function useBrandSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.brands(trimmed),
    queryFn: ({ signal }) => searchBrands(trimmed, signal),
    enabled: trimmed.length > 0,
    staleTime: 10 * 60_000,
    select: (data) => data.items,
  });
}
