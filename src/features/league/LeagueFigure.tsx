import { StyleSheet, View } from 'react-native';

import type { LeaguePiece } from '@/api/models';
import { figureBands } from '@/features/outfits/labels';
import { PieceTile, type FigurePiece } from '@/features/outfits/OutfitPieces';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { figurePieces, spokenSlots } from './labels';

/** How much of the figure's height each band takes, and how wide its well is as a share of the column. */
const BAND = {
  torso: { weight: 1, width: '88%' },
  bottom: { weight: 1.15, width: '80%' },
  shoes: { weight: 0.5, width: '62%' },
} as const;

/** The accessories row has room for this many wells; any more pieces of the outfit are not drawn. */
const MAX_ACCESSORIES = 3;

/**
 * The pieces the figure actually draws, in the order it draws them: one per band (the outerwear and the top share the
 * torso band) and at most `MAX_ACCESSORIES` accessories. The vote waits for these pictures and for no others.
 */
export function drawnPieces(pieces: readonly LeaguePiece[]): FigurePiece[] {
  const { bands, accessories } = figureBands(figurePieces(pieces));
  return [...bands.flatMap((band) => band.pieces), ...accessories.slice(0, MAX_ACCESSORIES)];
}

/** Two overlapping wells share the torso band (outerwear in front of the top), each this wide. */
const LAYERED_WIDTH = '66%';

interface LeagueFigureProps {
  pieces: readonly LeaguePiece[];
  /** One picture of the figure has loaded (or failed): the vote is timed from the moment all of them have. */
  onImageSettled?: () => void;
  testID?: string;
}

/**
 * An outfit as the standing figure, head to toe, filling the box it is given: the torso (a top, or the outerwear over it),
 * the bottom, the shoes, and the accessories as a row of small wells. The same wells and the same band order as every
 * other outfit in the app (`figureBands`, `PieceTile`); a piece without a picture (the owner's own view of a piece that
 * lost its image) shows the slot's placeholder. The league names no piece, so a screen reader gets the slots.
 */
export function LeagueFigure({ pieces, onImageSettled, testID }: LeagueFigureProps) {
  const { bands, accessories } = figureBands(figurePieces(pieces));
  return (
    <View
      style={styles.figure}
      accessible
      accessibilityRole="image"
      accessibilityLabel={tr.a11yOutfitFigure(spokenSlots(pieces))}
      testID={testID}
    >
      {bands.map((band) => {
        const size = BAND[band.kind];
        if (band.kind === 'torso' && band.pieces.length === 2) {
          const [outer, top] = band.pieces as [
            (typeof band.pieces)[number],
            (typeof band.pieces)[number],
          ];
          return (
            <View key="torso" style={[styles.band, { flex: size.weight }]}>
              <View style={styles.layers}>
                <PieceTile
                  piece={top}
                  shopping={false}
                  width={LAYERED_WIDTH}
                  height="100%"
                  layer="back"
                  wellStyle={styles.well}
                  onImageSettled={onImageSettled}
                />
                <PieceTile
                  piece={outer}
                  shopping={false}
                  width={LAYERED_WIDTH}
                  height="100%"
                  layer="front"
                  wellStyle={styles.layerFront}
                  onImageSettled={onImageSettled}
                />
              </View>
            </View>
          );
        }
        const piece = band.pieces[0];
        return (
          <View key={band.kind} style={[styles.band, { flex: size.weight }]}>
            <PieceTile
              piece={piece}
              shopping={false}
              width={size.width}
              height="100%"
              wellStyle={styles.well}
              onImageSettled={onImageSettled}
            />
          </View>
        );
      })}
      {accessories.length > 0 ? (
        <View style={styles.accessories}>
          {accessories.slice(0, MAX_ACCESSORIES).map((piece, index) => (
            <PieceTile
              key={`${piece.slot}-${index}`}
              piece={piece}
              shopping={false}
              width={theme.sizes.arenaAccessory}
              height={theme.sizes.arenaAccessory}
              wellStyle={styles.well}
              onImageSettled={onImageSettled}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: {
    flex: 1,
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  band: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layers: {
    width: '100%',
    height: '100%',
  },
  accessories: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  // The wells are `surface` on the white card; the front well's edge is the card's white, so the two read as layers.
  well: {
    backgroundColor: theme.colors.surface,
  },
  layerFront: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.bg,
  },
});
