import type { BudgetPiece, OutfitPiece } from '@/api/models';

/**
 * A budget piece in the shape the outfit figure draws. A wardrobe piece is `Wardrobe`; a catalog piece to buy is
 * `Gap`, which only matters for the grouping: the budget figure draws no ghost (see `OutfitPieces`).
 */
export function toFigurePiece(piece: BudgetPiece): OutfitPiece {
  return {
    slot: piece.slot,
    role: piece.source === 'Wardrobe' ? 'Wardrobe' : 'Gap',
    source: piece.source,
    wardrobeItemId: piece.wardrobeItemId,
    productId: piece.productId,
    name: piece.name,
    categorySlug: piece.categorySlug,
    color: piece.color,
    imageUrl: piece.imageUrl,
    offer: piece.offer
      ? {
          offerId: piece.offer.offerId,
          seller: piece.offer.seller,
          price: piece.offer.price,
          goPath: piece.offer.goPath,
        }
      : null,
  };
}
