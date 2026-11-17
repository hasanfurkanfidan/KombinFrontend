import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { OutfitPiece } from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { figureBands } from './labels';
import { lines } from '@/utils/a11y';

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

/**
 * What a figure needs of a piece. The outfit screens pass their `OutfitPiece`s; the league passes pieces that carry only
 * a slot and a picture (with the slot's name as `name`).
 */
export type FigurePiece = Pick<OutfitPiece, 'slot' | 'role' | 'name' | 'imageUrl' | 'offer'>;

interface PieceProps<P extends FigurePiece = OutfitPiece> {
  piece: P;
  /** An outfit of catalog ideas for an empty wardrobe: every piece is "from the store", none is missing. */
  shopping: boolean;
  /**
   * Replaces the label beside a well (budget outfits say "Dolabında var" or the price and a buy link per piece).
   * A figure with its own labels draws no ghost: a piece to buy is a normal piece there.
   */
  detail?: (piece: P) => ReactNode;
}

function priceOf(piece: FigurePiece): string | null {
  return piece.offer ? formatTry(toNumber(piece.offer.price)) : null;
}

/** One piece as a screen reader says it: the name, then what the picture and the label would have told. */
export function spokenPiece(piece: FigurePiece, shopping: boolean): string {
  const price = priceOf(piece);
  const parts: (string | null)[] = [piece.name];
  if (piece.role === 'Anchor') {
    parts.push(tr.outfitAnchor);
  } else if (shopping) {
    parts.push(price);
  } else if (piece.role === 'Gap') {
    parts.push(tr.a11yOutfitMissing(price ?? ''));
    parts.push(piece.offer?.seller ? tr.outfitCheapestAt(piece.offer.seller.name) : null);
  }
  return parts.filter(Boolean).join(', ');
}

/**
 * One garment's well in the figure. A wardrobe or catalog piece sits in a white well (cutouts and white-background
 * product photos read the same there); the anchor gets the green edge (it is the piece the user chose); a gap piece
 * (to buy) is a chalk-dashed ghost of itself carrying "Eksik · price".
 */
export function PieceTile<P extends FigurePiece = OutfitPiece>({
  piece,
  shopping,
  detail,
  width,
  height,
  layer,
  onImageSettled,
  wellStyle,
}: PieceProps<P> & {
  width: DimensionValue;
  height: DimensionValue;
  /** In a layered torso: the top sits behind, the outerwear in front. */
  layer?: 'back' | 'front';
  /** The picture loaded or failed to: the league times a vote from the moment every picture has settled. */
  onImageSettled?: () => void;
  /** Replaces the well's white (the league sits its figure on a white card, so its wells are `surface`). */
  wellStyle?: StyleProp<ViewStyle>;
}) {
  const gap = piece.role === 'Gap' && !shopping && !detail;
  const anchor = piece.role === 'Anchor';
  return (
    <View
      style={[
        styles.well,
        { width, height },
        layer === 'back' && styles.layerBack,
        layer === 'front' && styles.layerFront,
        // The ghost and anchor edges win over the layer gap; a ghost in front gets the panel fill so the top behind
        // does not show through it.
        gap && styles.ghost,
        gap && layer === 'front' && styles.ghostFront,
        anchor && styles.anchor,
        wellStyle,
      ]}
      testID={`piece-${piece.slot}`}
    >
      {piece.imageUrl ? (
        <AppImage
          uri={piece.imageUrl}
          style={[styles.image, gap && styles.ghostImage]}
          contentFit="contain"
          onLoad={onImageSettled}
          onError={onImageSettled}
          testID={`piece-image-${piece.slot}`}
        />
      ) : (
        <Icon
          name="shirt"
          size={typeof height === 'number' ? Math.min(48, height / 2) : 32}
          color={theme.colors.control}
          strokeWidth={1.4}
        />
      )}
      {gap ? (
        <View style={styles.missingTag} testID={`piece-pill-${piece.slot}`}>
          <Text style={styles.missingText}>{tr.outfitMissing(priceOf(piece) ?? '')}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The short label beside a well: a leader line and the piece's name. Only the exceptions get a status: the anchor
 * ("Ana parça"), a store piece of a shopping outfit (its price) and a missing piece (its seller; the ghost carries
 * "Eksik · price"). Owned pieces say nothing more: the sheet's "Bu kombin dolabından hazır" says it once.
 */
function Leader({ piece, shopping, detail }: PieceProps) {
  if (detail) {
    return (
      <View style={styles.leader}>
        <View style={styles.leaderLine} />
        <View style={styles.leaderText}>{detail(piece)}</View>
      </View>
    );
  }
  const gap = piece.role === 'Gap' && !shopping;
  const status = shopping
    ? priceOf(piece)
    : gap
      ? null
      : piece.role === 'Anchor'
        ? tr.outfitAnchor
        : null;
  return (
    <View style={styles.leader}>
      <View style={[styles.leaderLine, gap && styles.leaderLineGap]} />
      <View style={styles.leaderText}>
        <Text style={styles.name} numberOfLines={lines(2)}>
          {piece.name}
        </Text>
        {status ? (
          <View testID={`piece-pill-${piece.slot}`}>
            <Text style={shopping ? styles.price : styles.status}>{status}</Text>
          </View>
        ) : null}
        {/* The ghost already says "Eksik · price"; the label adds where it is cheapest. */}
        {gap && piece.offer?.seller ? (
          <Text style={styles.seller} numberOfLines={lines(1)}>
            {tr.outfitCheapestAt(piece.offer.seller.name)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A small accessory beside the figure: a thumbnail with its name and whether it is owned or missing. */
function AccessoryTile({ piece, shopping, detail }: PieceProps) {
  const gap = piece.role === 'Gap' && !shopping && !detail;
  const price = priceOf(piece);
  return (
    <View style={styles.accessory} testID="piece-accessory">
      <View style={[styles.accessoryWell, gap && styles.ghost]}>
        {piece.imageUrl ? (
          <AppImage
            uri={piece.imageUrl}
            style={[styles.image, gap && styles.ghostImage]}
            contentFit="contain"
          />
        ) : (
          <Icon name="shirt" size={24} color={theme.colors.control} strokeWidth={1.4} />
        )}
      </View>
      <View style={styles.leaderText}>
        {detail ? (
          detail(piece)
        ) : (
          <Text style={styles.name} numberOfLines={lines(2)}>
            {piece.name}
          </Text>
        )}
        {detail ? null : shopping && price ? (
          <Text style={styles.price}>{price}</Text>
        ) : gap && price ? (
          <Text style={styles.missingInline}>{tr.outfitMissing(price)}</Text>
        ) : null}
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
  detail,
  width,
}: {
  pieces: readonly OutfitPiece[];
  shopping?: boolean;
  detail?: (piece: OutfitPiece) => ReactNode;
  /** The area the panel may use; the screen width minus the padding when left out. */
  width?: number;
}) {
  const window = useWindowDimensions();
  const area = width ?? window.width - theme.screenPaddingX * 2;
  const figure = Math.round((area - PANEL_PADDING * 2) * theme.sizes.outfitFigureRatio);
  const { bands, accessories } = figureBands(pieces);
  // Head to toe, then the accessories: the order the eye takes. With a per-piece `detail` (the budget outfits' buy
  // links) the panel stays a group of controls instead of one picture.
  const spoken = detail
    ? undefined
    : tr.a11yOutfitFigure(
        [...bands.flatMap((band) => band.pieces), ...accessories]
          .map((piece) => spokenPiece(piece, shopping))
          .join('; '),
      );

  return (
    <View
      style={styles.panel}
      accessible={spoken !== undefined}
      accessibilityRole={spoken === undefined ? undefined : 'image'}
      accessibilityLabel={spoken}
      testID="outfit-figure"
    >
      {bands.map((band) => {
        if (band.kind === 'torso' && band.pieces.length === 2) {
          const [outer, top] = band.pieces as [OutfitPiece, OutfitPiece];
          const w = Math.round(figure * WELL.layered.width);
          const h = Math.round(figure * WELL.layered.height);
          return (
            <View key="torso" style={styles.band}>
              <View style={[styles.figureCell, { width: figure, height: h }]}>
                {/* The top behind, peeking out on the right; the outerwear in front of it, as it is worn. */}
                <PieceTile
                  piece={top}
                  shopping={shopping}
                  detail={detail}
                  width={w}
                  height={h}
                  layer="back"
                />
                <PieceTile
                  piece={outer}
                  shopping={shopping}
                  detail={detail}
                  width={w}
                  height={h}
                  layer="front"
                />
              </View>
              <View style={styles.labels}>
                <Leader piece={outer} shopping={shopping} detail={detail} />
                <Leader piece={top} shopping={shopping} detail={detail} />
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
                detail={detail}
                width={Math.round(figure * size.width)}
                height={h}
              />
            </View>
            <View style={styles.labels}>
              <Leader piece={piece} shopping={shopping} detail={detail} />
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
                detail={detail}
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
  ghostFront: {
    backgroundColor: theme.colors.surface,
  },
  layerBack: {
    position: 'absolute',
    right: 0,
  },
  // In front: a panel-coloured edge keeps the two white wells apart where they overlap.
  layerFront: {
    position: 'absolute',
    left: 0,
    borderWidth: theme.sizes.layerGap,
    borderColor: theme.colors.surface,
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
