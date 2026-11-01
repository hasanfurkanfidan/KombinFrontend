import type { SizeHint } from '@/api/models';

export type SizePill =
  /** The user's own entry (or one confirmed after a purchase): shown as a solid pill. */
  | { kind: 'known'; size: string }
  /** A stored guess, or a suggestion from the sizes at other brands: shown outlined with a "?". */
  | { kind: 'inferred'; size: string }
  | { kind: 'none' };

/** Decides what the size slot of the product title shows. */
export function sizePill(hint: SizeHint | null | undefined): SizePill {
  if (!hint) {
    return { kind: 'none' };
  }
  if (hint.size) {
    return hint.source === 'Inferred'
      ? { kind: 'inferred', size: hint.size }
      : { kind: 'known', size: hint.size };
  }
  if (hint.suggestion) {
    return { kind: 'inferred', size: hint.suggestion.size };
  }
  return { kind: 'none' };
}
