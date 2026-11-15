import { useQuery } from '@tanstack/react-query';

import { suggestBudgetOutfits, suggestBudgetOutfitsAnonymous } from '@/api/endpoints/budget';
import { queryKeys } from '@/api/queryKeys';

import { anonymousBody, signedInBody, type BudgetAsk } from './form';

/** Two asks that differ only in the seed: the outfits of the first are a fair stand-in while the second loads. */
function sameButSeed(a: BudgetAsk, b: BudgetAsk): boolean {
  return JSON.stringify({ ...a, seed: 0 }) === JSON.stringify({ ...b, seed: 0 });
}

/**
 * The answer to one ask. Nothing is kept as fresh (`staleTime` 0): the catalog moves, and a budget answer is only ever
 * for the request on screen. A new seed keeps the old outfits on screen until the next ones arrive; a new amount, date
 * or occasion does not (showing outfits for another budget would be wrong).
 */
export function useBudgetOutfits(ask: BudgetAsk | null) {
  return useQuery({
    queryKey: queryKeys.budgetOutfits(ask),
    queryFn: ({ signal }) =>
      ask!.signedIn
        ? suggestBudgetOutfits(signedInBody(ask!), signal)
        : suggestBudgetOutfitsAnonymous(anonymousBody(ask!), signal),
    enabled: ask !== null,
    staleTime: 0,
    placeholderData: (previous, previousQuery) => {
      const before = previousQuery?.queryKey[1] as BudgetAsk | null | undefined;
      return before && ask && sameButSeed(before, ask) ? previous : undefined;
    },
  });
}
