import { toNumber } from '@/utils/money';

/**
 * Scores below this are not shown anywhere (cards, detail, feed): "Sana uygun %58" reads as a weak claim, and a
 * first-time user cannot tell what it means. Only a clear match earns the words.
 */
export const MATCH_BADGE_MIN = 70;

/** The score to print in the badge, or null when there is none or it is too low. */
export function matchBadgeScore(score: number | string | null | undefined): number | null {
  if (score === null || score === undefined) {
    return null;
  }
  const value = Math.round(toNumber(score));
  return Number.isFinite(value) && value >= MATCH_BADGE_MIN ? value : null;
}
