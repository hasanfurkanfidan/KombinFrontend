import { Image, StyleSheet, View } from 'react-native';

import type { OutfitPiece, OutfitSlot } from '@/api/models';
import { Icon } from '@/components/Icon';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';

import { miniFigurePieces, sortPieces } from './labels';

interface OutfitCollageProps {
  pieces: readonly OutfitPiece[];
  /**
   * `grid`: a square 2×2 mini collage of the first four pieces in grid order (the saved list, the post flow).
   * `figure`: the small standing figure of the home card, three thumbnails stacked head to toe.
   */
  layout?: 'grid' | 'figure';
  testID?: string;
}

const MAX_CELLS = 4;

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

/** Small picture of an outfit built from its pieces' thumbnails. */
export function OutfitCollage({ pieces, layout = 'grid', testID }: OutfitCollageProps) {
  if (layout === 'figure') {
    return (
      <View style={styles.figure} testID={testID}>
        {miniFigurePieces(pieces).map((piece) => (
          <View
            key={`${piece.slot}-${piece.name}`}
            style={[
              styles.figureCell,
              { height: FIGURE_HEIGHT[piece.slot] ?? theme.sizes.homeFigureShoes },
              piece.slot === 'Shoes' && styles.figureShoes,
            ]}
            testID={`collage-cell-${piece.slot}`}
          >
            <Thumb piece={piece} />
          </View>
        ))}
      </View>
    );
  }
  const cells = sortPieces(pieces).slice(0, MAX_CELLS);
  return (
    <View style={styles.grid} testID={testID}>
      {cells.map((piece) => (
        <View
          key={`${piece.slot}-${piece.name}`}
          style={[styles.gridCell, { backgroundColor: colorTint(piece.color) }]}
          testID={`collage-cell-${piece.slot}`}
        >
          <Thumb piece={piece} />
        </View>
      ))}
    </View>
  );
}

const GAP = theme.spacing.xs;

const styles = StyleSheet.create({
  grid: {
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    borderRadius: theme.radius.tile,
    overflow: 'hidden',
  },
  gridCell: {
    // Two cells per row, with the gap between them taken out of each half.
    width: '48.5%',
    height: '48.5%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  figure: {
    width: theme.sizes.homeFigureWidth,
    alignItems: 'center',
    gap: GAP,
  },
  figureCell: {
    width: '100%',
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  figureShoes: {
    width: '72%',
  },
  image: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.xs,
  },
});
