import type { OutfitPiece, TryOn, TryOnFitLevel } from '@/api/models';
import { tr } from '@/i18n/tr';

/** The leader-line label of a piece's fit; `null` (nothing was comparable) says nothing. */
export function fitLabel(level: TryOnFitLevel | null): string | null {
  switch (level) {
    case 'Tight':
      return tr.tryOnFitTight;
    case 'TrueToSize':
      return tr.tryOnFitTrue;
    case 'Loose':
      return tr.tryOnFitLoose;
    default:
      return null;
  }
}

/** `Tight` and `Loose` are Kombin pointing at something (a chalk tag); `TrueToSize` is plain ink. */
export function fitIsNotable(level: TryOnFitLevel | null): boolean {
  return level === 'Tight' || level === 'Loose';
}

/** Names by the id the answer's garments use: the piece's wardrobe item or product id, as the outfit carries it. */
export type PieceNames = Readonly<Record<string, string>>;

export function outfitPieceNames(pieces: readonly OutfitPiece[]): PieceNames {
  const names: Record<string, string> = {};
  for (const piece of pieces) {
    const id = piece.wardrobeItemId ?? piece.productId;
    if (id) {
      names[id] = piece.name;
    }
  }
  return names;
}

export interface FitRow {
  id: string;
  name: string;
  label: string;
  notable: boolean;
}

/**
 * One row per drawn piece that has both a name on screen and a fit label, in the order the answer lists them. A piece
 * whose name is not known here (the wardrobe pieces around a product) or whose fit is `null` has no row.
 */
export function fitRows(answer: TryOn, names: PieceNames): FitRow[] {
  const rows: FitRow[] = [];
  for (const garment of answer.garments) {
    const name = names[garment.id];
    const label = fitLabel(garment.fitLevel);
    if (name && label) {
      rows.push({ id: garment.id, name, label, notable: fitIsNotable(garment.fitLevel) });
    }
  }
  return rows;
}

/** What a screen reader says for the picture: the pieces it was asked about, or the product and "its wardrobe pieces". */
export function spokenTryOn(names: PieceNames, productName: string | null): string {
  return productName
    ? tr.tryOnImageProduct(productName)
    : tr.tryOnImage(Object.values(names).join('; '));
}
