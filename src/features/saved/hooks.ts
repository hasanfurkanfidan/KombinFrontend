import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { listSaved, listSavedIds, saveProduct, unsaveProduct } from '@/api/endpoints/engagement';
import type { SavedIds } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { toNumber } from '@/utils/money';

export const SAVED_PAGE_SIZE = 20;

/** Ids of every saved product: one cached query for the session, so cards and detail agree. */
export function useSavedIds() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.savedIds,
    queryFn: ({ signal }) => listSavedIds(signal),
    enabled: isSignedIn,
    staleTime: 5 * 60_000,
    select: (data) => new Set(data.productIds),
  });
}

/**
 * Saved state and toggle for one product. The toggle updates the cached id list at once and rolls back on
 * failure; logged-out users are sent to the login screen instead.
 */
export function useSavedToggle(productId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSignedIn } = useSession();
  const saved = useSavedIds().data?.has(productId) ?? false;

  const mutation = useMutation({
    mutationFn: (save: boolean) => (save ? saveProduct(productId) : unsaveProduct(productId)),
    onMutate: async (save) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.savedIds });
      const previous = queryClient.getQueryData<SavedIds>(queryKeys.savedIds);
      const others = (previous?.productIds ?? []).filter((id) => id !== productId);
      queryClient.setQueryData<SavedIds>(queryKeys.savedIds, {
        productIds: save ? [...others, productId] : others,
      });
      return { previous };
    },
    onError: (_error, _save, context) => {
      queryClient.setQueryData(queryKeys.savedIds, context?.previous);
      showToast(tr.saveFailed);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.savedIds }),
        queryClient.invalidateQueries({ queryKey: queryKeys.saved }),
      ]);
    },
  });

  const toggle = () => {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    mutation.mutate(!saved);
  };

  return { saved, toggle };
}

/** The Kaydedilenler grid: `GET /me/saved`, page by page. */
export function useSavedProducts() {
  const { isSignedIn } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.saved,
    queryFn: ({ pageParam, signal }) => listSaved(pageParam, SAVED_PAGE_SIZE, signal),
    initialPageParam: 1,
    enabled: isSignedIn,
    getNextPageParam: (lastPage) => {
      const page = toNumber(lastPage.page);
      const totalPages = Math.ceil(toNumber(lastPage.totalCount) / toNumber(lastPage.pageSize));
      return page < totalPages ? page + 1 : undefined;
    },
  });
}
