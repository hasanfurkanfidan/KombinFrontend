import type { CategoryValue, WardrobeOverview, WardrobeValue } from '@/api/models';
import { tr } from '@/i18n/tr';
import { toNumber } from '@/utils/money';

/** The backend refuses an analytics count above this. */
const EVENT_COUNT_MAX = 2000;

/** With too few pieces the backend sends only `pieceCount` and `message`: no totals, nothing that could be a zero. */
export function isSmallWardrobe(overview: WardrobeOverview): boolean {
  return overview.value === null;
}

/**
 * "3 parçanın fiyatı kayıtlı, 2 parçanın fiyatı tahmini, 1 parçanın fiyatı yok." Built from the disjoint counts, so
 * they add up to the pieces; a clause with a count of zero is left out. `null` when no piece is counted at all.
 */
export function valueCountsSentence(counts: WardrobeValue['counts']): string | null {
  const clauses = [
    [toNumber(counts.priced), tr.wardrobeValuePriced],
    [toNumber(counts.estimated), tr.wardrobeValueEstimated],
    [toNumber(counts.unpriced), tr.wardrobeValueUnpriced],
  ] as const;
  const parts = clauses.filter(([count]) => count > 0).map(([count, say]) => say(count));
  return parts.length > 0 ? `${parts.join(', ')}.` : null;
}

/** Largest category first; a category with no priced piece (`total` null) goes last. */
export function sortCategories(categories: readonly CategoryValue[]): CategoryValue[] {
  const amount = (category: CategoryValue) =>
    category.total === null ? -1 : toNumber(category.total);
  return [...categories].sort((a, b) => amount(b) - amount(a));
}

/** Pieces whose price is not the user's own: the line that explains "tahmini" and the way to fix it. */
export function unpricedCount(value: WardrobeValue): number {
  return toNumber(value.counts.unpriced);
}

/** The `wardrobe_summary_view` properties: counts and one flag, capped where the backend caps them. */
export function summaryViewProps(overview: WardrobeOverview) {
  return {
    pieceCount: Math.min(toNumber(overview.pieceCount), EVENT_COUNT_MAX),
    unwornCount: Math.min(
      overview.unworn ? toNumber(overview.unworn.totalCount) : 0,
      EVENT_COUNT_MAX,
    ),
    hasEstimate: overview.value?.isEstimate ?? false,
  };
}
