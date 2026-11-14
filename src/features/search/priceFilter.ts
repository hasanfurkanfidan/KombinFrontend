import { z } from 'zod';

import { tr } from '@/i18n/tr';
import { formatAmount } from '@/utils/money';

export interface PriceRange {
  minPrice?: number;
  maxPrice?: number;
}

/** The chip's text: the range when one is set, otherwise just "Fiyat". */
export function priceLabel({ minPrice, maxPrice }: PriceRange): string {
  if (minPrice !== undefined && maxPrice !== undefined) {
    return tr.searchPriceRange(formatAmount(minPrice), formatAmount(maxPrice));
  }
  if (minPrice !== undefined) {
    return tr.searchPriceFrom(formatAmount(minPrice));
  }
  if (maxPrice !== undefined) {
    return tr.searchPriceUpTo(formatAmount(maxPrice));
  }
  return tr.searchFilterPrice;
}

/** Whole liras typed as text; blank means "no bound". */
const amount = z
  .string()
  .trim()
  .regex(/^\d{0,7}$/, tr.searchPriceInvalid)
  .transform((text) => (text === '' ? undefined : Number(text)));

export const priceSchema = z
  .object({ minPrice: amount, maxPrice: amount })
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    { message: tr.searchPriceOrder, path: ['maxPrice'] },
  );

export type PriceInput = z.input<typeof priceSchema>;
export type PriceOutput = z.output<typeof priceSchema>;
