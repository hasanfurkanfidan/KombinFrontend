import type { ProductFit, ProductPattern } from '@/api/models';
import { tr } from '@/i18n/tr';

/** The top-level categories the wardrobe filter offers (slugs of the catalog tree; a filter includes the children). */
export const CATEGORY_GROUPS = [
  { slug: 'ust-giyim', label: tr.wardrobeCategoryTop },
  { slug: 'alt-giyim', label: tr.wardrobeCategoryBottom },
  { slug: 'dis-giyim', label: tr.wardrobeCategoryOuterwear },
  { slug: 'ayakkabi', label: tr.wardrobeCategoryShoes },
  { slug: 'aksesuar', label: tr.wardrobeCategoryAccessories },
] as const;

export const patternLabels: Record<ProductPattern, string> = {
  Solid: tr.patternSolid,
  Striped: tr.patternStriped,
  Checked: tr.patternChecked,
  Printed: tr.patternPrinted,
  Textured: tr.patternTextured,
  Other: tr.patternOther,
};

export const fitLabels: Record<ProductFit, string> = {
  Slim: tr.fitSlim,
  Regular: tr.fitRegular,
  Relaxed: tr.fitRelaxed,
  Oversized: tr.fitOversized,
  Unknown: tr.fitUnknown,
};

export const FORMALITY_LABELS: Record<number, string> = {
  1: tr.formality1,
  2: tr.formality2,
  3: tr.formality3,
  4: tr.formality4,
  5: tr.formality5,
};

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export type Season = (typeof SEASONS)[number];

export const seasonLabels: Record<Season, string> = {
  Spring: tr.seasonSpring,
  Summer: tr.seasonSummer,
  Autumn: tr.seasonAutumn,
  Winter: tr.seasonWinter,
};

/** What the confirm sheet says about a photo that came out poorly; the first known warning wins. */
const WARNING_HINTS: Record<string, string> = {
  person_wearing: tr.wardrobeWarningPerson,
  multiple_items: tr.wardrobeWarningMultiple,
  blurry: tr.wardrobeWarningBlurry,
  dark: tr.wardrobeWarningDark,
};

export function warningHint(warnings: readonly string[]): string | null {
  const known = warnings.find((warning) => Object.hasOwn(WARNING_HINTS, warning));
  return known ? (WARNING_HINTS[known] ?? null) : null;
}
