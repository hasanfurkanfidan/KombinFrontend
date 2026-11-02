import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  dismissOutfit,
  getDailyOutfit,
  getHowToWear,
  getOutfit,
  listSavedOutfits,
  saveOutfit,
  wearOutfit,
} from '@/api/endpoints/outfits';
import type { DailyOutfit, HowToWear, Outfit } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';
import { toNumber } from '@/utils/money';

import type { OccasionValue } from './labels';

/** A day's outfits are cheap to keep and expensive to reshuffle: an hour, and wardrobe changes invalidate them. */
const OUTFIT_STALE_MS = 60 * 60_000;
export const HOW_TO_WEAR_COUNT = 5;

export interface DailyParams {
  /** `today`, `tomorrow` or `yyyy-MM-dd`. */
  date: string;
  occasion?: OccasionValue;
  seed: number;
}

/** `enabled` is the caller's gate (signed in, wardrobe not empty for the home card, ...). */
export function useDailyOutfit(params: DailyParams, enabled = true) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.dailyOutfit({
      date: params.date,
      occasion: params.occasion ?? null,
      seed: params.seed,
    }),
    queryFn: ({ signal }) => getDailyOutfit(params, signal),
    enabled: enabled && isSignedIn,
    staleTime: OUTFIT_STALE_MS,
    // A shuffle keeps showing the outfit it came from until the next one is there.
    placeholderData: keepPreviousData,
  });
}

export function useHowToWear(target: { productId?: string; wardrobeItemId?: string }) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.howToWear({
      productId: target.productId ?? null,
      wardrobeItemId: target.wardrobeItemId ?? null,
    }),
    queryFn: ({ signal }) => getHowToWear({ ...target, count: HOW_TO_WEAR_COUNT }, signal),
    enabled: isSignedIn && Boolean(target.productId ?? target.wardrobeItemId),
    staleTime: OUTFIT_STALE_MS,
  });
}

export function useOutfit(id: string) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.outfit(id),
    queryFn: ({ signal }) => getOutfit(id, signal),
    enabled: isSignedIn,
  });
}

const SAVED_PAGE_SIZE = 20;

export function useSavedOutfits() {
  const { isSignedIn } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.savedOutfits,
    queryFn: ({ pageParam, signal }) => listSavedOutfits(pageParam, SAVED_PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const page = toNumber(last.page);
      return page < Math.ceil(toNumber(last.totalCount) / toNumber(last.pageSize))
        ? page + 1
        : undefined;
    },
    enabled: isSignedIn,
  });
}

function isDaily(data: unknown): data is DailyOutfit {
  return typeof data === 'object' && data !== null && 'alternatives' in data;
}

function isHowToWear(data: unknown): data is HowToWear {
  return typeof data === 'object' && data !== null && 'outfits' in data;
}

function isOutfit(data: unknown): data is Outfit {
  return typeof data === 'object' && data !== null && 'pieces' in data;
}

/** Writes a changed outfit (saved, worn) into every cached place it is shown: daily, how-to-wear and its own entry. */
export function patchOutfit(queryClient: QueryClient, next: Outfit): void {
  const swap = (outfit: Outfit) => (outfit.id === next.id ? next : outfit);
  queryClient.setQueriesData({ queryKey: queryKeys.outfitsAll }, (data: unknown) => {
    if (isDaily(data)) {
      return {
        ...data,
        outfit: data.outfit ? swap(data.outfit) : data.outfit,
        alternatives: data.alternatives.map(swap),
      };
    }
    if (isHowToWear(data)) {
      return { ...data, outfits: data.outfits.map(swap) };
    }
    if (isOutfit(data)) {
      return swap(data);
    }
    return data;
  });
}

export function useSaveOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => saveOutfit(id),
    onSuccess: (outfit) => {
      patchOutfit(queryClient, outfit);
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedOutfits });
    },
  });
}

export function useWearOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wearOutfit(id),
    onSuccess: (outfit) => {
      patchOutfit(queryClient, outfit);
      // The wardrobe pieces were worn: their counts and the stats change.
      void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeAll });
    },
  });
}

/** Dismissing hides the pieces for 30 days, so the day's outfits (and the home card) are asked for again. */
export function useDismissOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => dismissOutfit(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dailyOutfitsAll }),
  });
}
