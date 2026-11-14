import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { OutfitPiece } from '@/api/models';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { figureBands } from './labels';

const PANEL_PADDING = theme.spacing.lg;
const BAND_GAP = theme.spacing.sm;

/**
 * Each slot's well, as a share of the figure column's width: top and bottom large, shoes small. A layered torso
 * (outerwear over a top) draws two narrower wells that overlap.
 */
const WELL = {
  torso: { width: 1, height: 0.82 },
  layered: { width: 0.66, height: 0.82 },
  bottom: { width: 0.86, height: 1 },
  shoes: { width: 0.6, height: 0.4 },
} as const;

interface PieceProps {
  piece: OutfitPiece;
  /** An outfit of catalog ideas for an empty wardrobe: every piece is "from the store", none is missing. */
  shopping: boolean;
}

function priceOf(piece: OutfitPiece): string | null {
  return piece.offer ? formatTry(toNumber(piece.offer.price)) : null;
}

/**
 * One garment's well in the figure. A wardrobe or catalog piece sits in a white well (cutouts and white-background
 * product photos read the same there); the anchor gets the green edge (it is the piece the user chose); a gap piece
 * (to buy) is a chalk-dashed ghost of itself carrying "Eksik · price".
 */
export function PieceTile({
  piece,
  shopping,
  width,
  height,
  style,
}: PieceProps & { width: number; height: number; style?: object }) {
  const gap = piece.role === 'Gap' && !shopping;
  const anchor = piece.role === 'Anchor';
  return (
    <View
      style={[styles.well, { width, height }, gap && styles.ghost, anchor && styles.anchor, style]}
      testID={`piece-${piece.slot}`}
    >
      {piece.imageUrl ? (
        <Image
          source={{ uri: piece.imageUrl }}
          style={[styles.image, gap && styles.ghostImage]}
          resizeMode="contain"
        />
      ) : (
        <Icon
          name="shirt"
          size={Math.min(48, height / 2)}
          color={theme.colors.control}
          strokeWidth={1.4}
        />
      )}
      {gap ? (
        <View style={styles.missingTag} testID={`piece-pill-${piece.slot}`}>
          <Text style={styles.missingText} numberOfLines={1}>
            {tr.outfitMissing(priceOf(piece) ?? '')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The short label beside a well: a leader line, the piece's name and what it is (yours, the anchor, its price). */
function Leader({ piece, shopping }: PieceProps) {
  const gap = piece.role === 'Gap' && !shopping;
  const status = shopping
    ? priceOf(piece)
    : gap
      ? null
      : piece.role === 'Anchor'
        ? tr.outfitAnchor
        : piece.source === 'Wardrobe'
          ? tr.outfitInWardrobe
          : null;
  return (
    <View style={styles.leader}>
      <View style={[styles.leaderLine, gap && styles.leaderLineGap]} />
      <View style={styles.leaderText}>
        <Text style={styles.name} numberOfLines={2}>
          {piece.name}
        </Text>
        {status ? (
          <View testID={`piece-pill-${piece.slot}`}>
            <Text style={shopping ? styles.price : styles.status} numberOfLines={1}>
              {status}
            </Text>
          </View>
        ) : null}
        {/* The ghost already says "Eksik · price"; the label adds where it is cheapest. */}
        {gap && piece.offer?.seller ? (
          <Text style={styles.seller} numberOfLines={1}>
            {tr.outfitCheapestAt(piece.offer.seller.name)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A small accessory beside the figure: a thumbnail with its name and whether it is owned or missing. */
function AccessoryTile({ piece, shopping }: PieceProps) {
  const gap = piece.role === 'Gap' && !shopping;
  const price = priceOf(piece);
  return (
    <View style={styles.accessory} testID="piece-accessory">
      <View style={[styles.accessoryWell, gap && styles.ghost]}>
        {piece.imageUrl ? (
          <Image
            source={{ uri: piece.imageUrl }}
            style={[styles.image, gap && styles.ghostImage]}
            resizeMode="contain"
          />
        ) : (
          <Icon name="shirt" size={24} color={theme.colors.control} strokeWidth={1.4} />
        )}
      </View>
      <View style={styles.leaderText}>
        <Text style={styles.name} numberOfLines={2}>
          {piece.name}
        </Text>
        <Text style={gap ? styles.missingInline : styles.status} numberOfLines={1}>
          {shopping ? price : gap && price ? tr.outfitMissing(price) : tr.outfitInWardrobe}
        </Text>
      </View>
    </View>
  );
}

/**
 * The outfit as a standing figure on a surface panel: the torso (a top, or outerwear layered over it) at the top, the
 * bottom below, the shoes at the base, each well sized by its role with a short leader label beside it; accessories
 * are small side tiles under the labels.
 */
export function OutfitPieces({
  pieces,
  shopping = false,
  width,
}: {
  pieces: readonly OutfitPiece[];
  shopping?: boolean;
  /** The area the panel may use; the screen width minus the padding when left out. */
  width?: number;
}) {
  const window = useWindowDimensions();
  const area = width ?? window.width - theme.screenPaddingX * 2;
  const figure = Math.round((area - PANEL_PADDING * 2) * theme.sizes.outfitFigureRatio);
  const { bands, accessories } = figureBands(pieces);

  return (
    <View style={styles.panel} testID="outfit-figure">
      {bands.map((band) => {
        if (band.kind === 'torso' && band.pieces.length === 2) {
          const [outer, top] = band.pieces as [OutfitPiece, OutfitPiece];
          const w = Math.round(figure * WELL.layered.width);
          const h = Math.round(figure * WELL.layered.height);
          return (
            <View key="torso" style={styles.band}>
              <View style={[styles.figureCell, { width: figure, height: h }]}>
                <PieceTile
                  piece={outer}
                  shopping={shopping}
                  width={w}
                  height={h}
                  style={styles.layerBack}
                />
                <PieceTile
                  piece={top}
                  shopping={shopping}
                  width={w}
                  height={h}
                  style={styles.layerFront}
                />
              </View>
              <View style={styles.labels}>
                <Leader piece={top} shopping={shopping} />
                <Leader piece={outer} shopping={shopping} />
              </View>
            </View>
          );
        }
        const piece = band.pieces[0] as OutfitPiece;
        const size = WELL[band.kind];
        const h = Math.round(figure * size.height);
        return (
          <View key={band.kind} style={styles.band}>
            <View style={[styles.figureCell, { width: figure, height: h }]}>
              <PieceTile
                piece={piece}
                shopping={shopping}
                width={Math.round(figure * size.width)}
                height={h}
              />
            </View>
            <View style={styles.labels}>
              <Leader piece={piece} shopping={shopping} />
            </View>
          </View>
        );
      })}
      {accessories.length > 0 ? (
        <View style={styles.band}>
          <View style={{ width: figure }} />
          <View style={styles.labels}>
            {accessories.map((piece) => (
              <AccessoryTile
                key={`${piece.slot}-${piece.name}`}
                piece={piece}
                shopping={shopping}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.panel,
    padding: PANEL_PADDING,
    gap: BAND_GAP,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  figureCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flex: 1,
    gap: theme.spacing.md,
  },
  well: {
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  anchor: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: theme.sizes.dashedBorder,
    borderStyle: 'dashed',
    borderColor: theme.colors.chalkLine,
  },
  ghostImage: {
    opacity: 0.45,
  },
  layerBack: {
    position: 'absolute',
    left: 0,
  },
  layerFront: {
    position: 'absolute',
    right: 0,
  },
  image: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.sm,
  },
  missingTag: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    alignSelf: 'center',
    maxWidth: '92%',
    backgroundColor: theme.colors.chalk,
    borderRadius: theme.radius.tag,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  missingText: {
    ...theme.typography.captionStrong,
    fontVariant: ['tabular-nums'],
    color: theme.colors.chalkInk,
  },
  leader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  leaderLine: {
    width: theme.sizes.leaderLine,
    height: 1,
    backgroundColor: theme.colors.control,
  },
  leaderLineGap: {
    backgroundColor: theme.colors.chalkLine,
  },
  leaderText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  status: {
    ...theme.typography.captionStrong,
    color: theme.colors.primary,
  },
  price: {
    ...theme.typography.price,
    color: theme.colors.ink,
  },
  seller: {
    ...theme.typography.caption,
    color: theme.colors.ink2,
  },
  missingInline: {
    ...theme.typography.captionStrong,
    fontVariant: ['tabular-nums'],
    color: theme.colors.chalkInk,
  },
  accessory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  accessoryWell: {
    width: theme.sizes.outfitAccessoryTile,
    height: theme.sizes.outfitAccessoryTile,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
