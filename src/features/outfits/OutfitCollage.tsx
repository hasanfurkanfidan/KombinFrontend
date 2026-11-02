import { Image, StyleSheet, View } from 'react-native';

import type { OutfitPiece } from '@/api/models';
import { Icon } from '@/components/Icon';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';

import { sortPieces } from './labels';

interface OutfitCollageProps {
  pieces: readonly OutfitPiece[];
  /**
   * `grid`: a square 2×2 mini collage (the saved list). `row`: the four pieces side by side on a dark card (the
   * home card). Both show the first four pieces in grid order; the accessory only appears when there is room.
   */
  layout?: 'grid' | 'row';
  testID?: string;
}

const MAX_CELLS = 4;

function Cell({ piece, layout }: { piece: OutfitPiece; layout: 'grid' | 'row' }) {
  return (
    <View
      style={[
        layout === 'grid' ? styles.gridCell : styles.rowCell,
        { backgroundColor: colorTint(piece.color) },
      ]}
      testID={`collage-cell-${piece.slot}`}
    >
      {piece.imageUrl ? (
        <Image source={{ uri: piece.imageUrl }} style={styles.image} resizeMode="contain" />
      ) : (
        <Icon name="shirt" size={24} color={theme.colors.borderStrong} strokeWidth={1.4} />
      )}
    </View>
  );
}

/** Small picture of an outfit built from its pieces' thumbnails. */
export function OutfitCollage({ pieces, layout = 'grid', testID }: OutfitCollageProps) {
  const cells = sortPieces(pieces).slice(0, MAX_CELLS);
  return (
    <View style={layout === 'grid' ? styles.grid : styles.row} testID={testID}>
      {cells.map((piece) => (
        <Cell key={`${piece.slot}-${piece.name}`} piece={piece} layout={layout} />
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
    borderRadius: theme.radius.xl,
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
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  rowCell: {
    flex: 1,
    height: theme.sizes.homeCardThumbHeight,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.xs,
  },
});
