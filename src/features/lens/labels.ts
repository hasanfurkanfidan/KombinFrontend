import { ApiError } from '@/api/client';
import type { CategoryFamily, LensRegion } from '@/api/models';
import { tr } from '@/i18n/tr';

const FAMILY_LABELS: Record<CategoryFamily, string> = {
  Top: tr.lensFamilyTop,
  Bottom: tr.lensFamilyBottom,
  Outerwear: tr.lensFamilyOuterwear,
  Shoes: tr.lensFamilyShoes,
  Bag: tr.lensFamilyBag,
  Accessory: tr.lensFamilyAccessory,
};

/** What a region is called above its rail: its category family, or "Fotoğrafın tamamı" when nothing was detected. */
export function regionTitle(region: LensRegion, wholePhoto: boolean): string {
  if (wholePhoto || region.family === null) {
    return wholePhoto ? tr.lensWholePhoto : tr.lensFamilyUnknown;
  }
  return FAMILY_LABELS[region.family];
}

export function levelLabel(level: string): string {
  return level === 'close' ? tr.lensLevelClose : tr.lensLevelSimilar;
}

/** The analytics bucket of a result: the backend's `level`, anything unknown counted as `similar`. */
export function similarityBucket(level: string): 'close' | 'similar' {
  return level === 'close' ? 'close' : 'similar';
}

export type LensErrorKind = 'unreadable' | 'failed';

/**
 * A 400 (`Lens.ImageTooLarge`, `UnsupportedImage`, …) or a photo the phone itself could not re-encode is a photo we
 * cannot read: another one is the way out. Everything else (offline, 5xx, `Lens.VisionUnavailable`) is worth a retry.
 */
export function lensErrorKind(error: unknown): LensErrorKind {
  if (error instanceof ApiError) {
    return error.status === 400 ? 'unreadable' : 'failed';
  }
  return 'unreadable';
}
