import type { BudgetPiece } from '@/api/models';
import { tr } from '@/i18n/tr';
import { formatAmount, toNumber } from '@/utils/money';

/**
 * THE SWITCH for the line under a bought piece's price on the budget screen. The contract's `BudgetOfferResponse`
 * carries `shippingCost` and says `price` already includes it, so the line is always true for a bought piece.
 */
export const SHIPPING_NOTE_ENABLED = true;

/**
 * The line to show under the price of one piece, or `null` for none (an owned piece has no offer): "kargo dahil" when
 * the seller ships free, "{x} ₺ kargo dahil" when the price already carries the shipping fee.
 */
export function shippingNote(piece: BudgetPiece): string | null {
  if (!SHIPPING_NOTE_ENABLED || !piece.offer) {
    return null;
  }
  const shipping = toNumber(piece.offer.shippingCost);
  return shipping > 0
    ? tr.budgetShippingWithFee(formatAmount(shipping))
    : tr.budgetShippingIncluded;
}
