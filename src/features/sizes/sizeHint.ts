import type { SizeHint } from '@/api/models';
import { toNumber } from '@/utils/money';

/** Below this the guess is shown with "emin değiliz" (the backend caps an inferred size at 0.8). */
export const LOW_SIZE_CONFIDENCE = 0.6;

export type SizePill =
  /** The user's own entry (or one confirmed after a purchase): shown as a solid pill. */
  | { kind: 'known'; size: string }
  /** A stored guess, or a suggestion from the sizes at other brands: "Tahmini beden: L", plus "emin değiliz" when unsure. */
  | { kind: 'inferred'; size: string; unsure: boolean }
  | { kind: 'none' };

/** Decides what the size slot of the product title shows. */
export function sizePill(hint: SizeHint | null | undefined): SizePill {
  if (!hint) {
    return { kind: 'none' };
  }
  if (hint.size) {
    return hint.source === 'Inferred'
      ? { kind: 'inferred', size: hint.size, unsure: isUnsure(hint.confidence) }
      : { kind: 'known', size: hint.size };
  }
  if (hint.suggestion) {
    return {
      kind: 'inferred',
      size: hint.suggestion.size,
      unsure: isUnsure(hint.suggestion.confidence),
    };
  }
  return { kind: 'none' };
}

/** No confidence counts as unsure: a guess we cannot back is said to be one. */
function isUnsure(confidence: number | string | null | undefined): boolean {
  return (
    confidence === null || confidence === undefined || toNumber(confidence) < LOW_SIZE_CONFIDENCE
  );
}
