import { Image, StyleSheet, View } from 'react-native';

import type { OutfitPiece, OutfitSlot } from '@/api/models';
import { Icon } from '@/components/Icon';
import { theme } from '@/theme';

import { miniFigurePieces } from './labels';

interface OutfitMiniFigureProps {
  pieces: readonly OutfitPiece[];
  testID?: string;
}

/** Height of a stacked thumbnail by its place on the figure: top and bottom large, shoes small. */
const FIGURE_HEIGHT: Partial<Record<OutfitSlot, number>> = {
  Top: theme.sizes.homeFigureTorso,
  Outerwear: theme.sizes.homeFigureTorso,
  Bottom: theme.sizes.homeFigureBottom,
  Shoes: theme.sizes.homeFigureShoes,
};

function Thumb({ piece }: { piece: OutfitPiece }) {
  return piece.imageUrl ? (
    <Image source={{ uri: piece.imageUrl }} style={styles.image} resizeMode="contain" />
  ) : (
    <Icon name="shirt" size={20} color={theme.colors.control} strokeWidth={1.4} />
  );
}

/**
 * The small standing figure: three stacked thumbnails, head to toe. It is the one miniature of an outfit, so an
 * outfit looks the same on the Keşfet card, in "Kaydedilen kombinler", in the post flow's picker and in "Dolabımla dene".
 */
export function OutfitMiniFigure({ pieces, testID }: OutfitMiniFigureProps) {
  return (
    <View style={styles.figure} testID={testID}>
      {miniFigurePieces(pieces).map((piece) => (
        <View
          key={`${piece.slot}-${piece.name}`}
          style={[
            styles.cell,
            { height: FIGURE_HEIGHT[piece.slot] ?? theme.sizes.homeFigureShoes },
            piece.slot === 'Shoes' && styles.shoes,
          ]}
          testID={`figure-cell-${piece.slot}`}
        >
          <Thumb piece={piece} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: {
    width: theme.sizes.homeFigureWidth,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  cell: {
    width: '100%',
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shoes: {
    width: '72%',
  },
  image: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.xs,
  },
});
