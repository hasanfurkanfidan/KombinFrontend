import type { BudgetPiece } from '@/api/models';
import { tr } from '@/i18n/tr';

/**
 * THE SWITCH for the "kargo dahil" line under a bought piece's price on the budget screen.
 *
 * The backend is adding `shippingCost` to the budget offer; it is not in `docs/openapi.json` yet, so no type or
 * field is invented here. When the contract has it: regenerate the types (`npm run api:types`), read the field in
 * `shippingNote` below, and set this to `true`. Nothing else changes: `BudgetOutfitSection` already passes the note
 * to the piece row, which already draws it.
 */
export const SHIPPING_NOTE_ENABLED = false;

/** The line to show under the price of one piece ("kargo dahil"), or `null` for none. */
export function shippingNote(piece: BudgetPiece): string | null {
  if (!SHIPPING_NOTE_ENABLED) {
    return null;
  }
  // TODO(contract): decide from the offer's `shippingCost` once it exists, e.g.
  //   return piece.offer && piece.offer.shippingCost === 0 ? tr.budgetShippingIncluded : null;
  void piece;
  return tr.budgetShippingIncluded;
}
