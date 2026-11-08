import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { OutfitPiece } from '@/api/models';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { formatTry, toNumber } from '@/utils/money';

import { sortPieces } from './labels';

const GAP = theme.spacing.md;

interface PieceTileProps {
  piece: OutfitPiece;
  width: number;
  /** An outfit of catalog ideas for an empty wardrobe: every piece is "from the store", none is missing. */
  shopping?: boolean;
}

/**
 * One garment of an outfit. Wardrobe pieces carry the white "Dolabında var" pill (and nothing else says so); a gap piece (to buy) has the accent
 * border, an "Eksik · price" pill and the cheapest seller; the anchor (the product or item the outfit is built
 * around) gets an ink border.
 */
export function PieceTile({ piece, width, shopping = false }: PieceTileProps) {
  const gap = piece.role === 'Gap';
  const anchor = piece.role === 'Anchor';
  const offer = piece.offer;
  const price = offer ? formatTry(toNumber(offer.price)) : null;
  const pill = shopping
    ? price
    : gap
      ? tr.outfitMissing(price ?? '')
      : anchor
        ? tr.outfitAnchor
        : piece.source === 'Wardrobe'
          ? tr.outfitInWardrobe
          : null;
  const highlighted = gap || shopping;

  return (
    <View style={{ width, gap: theme.spacing.sm }} testID={`piece-${piece.slot}`}>
      <View
        style={[
          styles.tile,
          { height: width, backgroundColor: colorTint(piece.color) },
          highlighted && styles.tileGap,
          anchor && styles.tileAnchor,
        ]}
      >
        {piece.imageUrl ? (
          <Image source={{ uri: piece.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <Icon name="shirt" size={48} color={theme.colors.borderStrong} strokeWidth={1.4} />
        )}
        {pill ? (
          <View
            style={[
              styles.pill,
              highlighted ? styles.pillGap : anchor ? styles.pillAnchor : styles.pillOwned,
            ]}
            testID={`piece-pill-${piece.slot}`}
          >
            <Text style={[styles.pillText, (highlighted || anchor) && styles.pillTextLight]}>
              {pill}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.caption}>
        <Text style={styles.name} numberOfLines={2}>
          {piece.name}
        </Text>
        {/* An owned piece already carries the "Dolabında var" pill: no second caption saying the same. */}
        {gap && offer?.seller ? (
          <Text style={styles.seller} numberOfLines={1}>
            {tr.outfitCheapestAt(offer.seller.name)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** The outfit's pieces: a two-column grid, and the accessory (when there is one) as a small tile below it. */
export function OutfitPieces({
  pieces,
  shopping = false,
  width,
}: {
  pieces: readonly OutfitPiece[];
  shopping?: boolean;
  /** The area the grid may use; the screen width minus the padding when left out. */
  width?: number;
}) {
  const window = useWindowDimensions();
  const area = width ?? window.width - theme.screenPaddingX * 2;
  const tileWidth = (area - GAP) / 2;
  const sorted = sortPieces(pieces);
  const main = sorted.filter((piece) => piece.slot !== 'Accessory');
  const accessories = sorted.filter((piece) => piece.slot === 'Accessory');

  return (
    <View style={styles.pieces}>
      <View style={styles.grid}>
        {main.map((piece) => (
          <PieceTile
            key={`${piece.slot}-${piece.name}`}
            piece={piece}
            width={tileWidth}
            shopping={shopping}
          />
        ))}
      </View>
      {accessories.map((piece) => (
        <View key={`${piece.slot}-${piece.name}`} style={styles.accessory} testID="piece-accessory">
          <View
            style={[
              styles.accessoryThumb,
              { backgroundColor: colorTint(piece.color) },
              (piece.role === 'Gap' || shopping) && styles.tileGap,
            ]}
          >
            {piece.imageUrl ? (
              <Image source={{ uri: piece.imageUrl }} style={styles.image} resizeMode="contain" />
            ) : (
              <Icon name="shirt" size={24} color={theme.colors.borderStrong} strokeWidth={1.4} />
            )}
          </View>
          <View style={styles.caption}>
            <Text style={styles.name} numberOfLines={2}>
              {piece.name}
            </Text>
            <Text style={piece.role === 'Gap' ? styles.seller : styles.owned} numberOfLines={1}>
              {piece.role === 'Gap' && piece.offer
                ? tr.outfitMissing(formatTry(toNumber(piece.offer.price)))
                : tr.outfitInWardrobe}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pieces: {
    gap: theme.spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    borderRadius: theme.radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileGap: {
    borderColor: theme.colors.accent,
  },
  tileAnchor: {
    borderColor: theme.colors.ink,
  },
  image: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.lg,
  },
  pill: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  pillOwned: {
    backgroundColor: theme.colors.surface,
  },
  pillGap: {
    backgroundColor: theme.colors.accent,
  },
  pillAnchor: {
    backgroundColor: theme.colors.ink,
  },
  pillText: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  pillTextLight: {
    color: theme.colors.onInk,
  },
  caption: {
    flexShrink: 1,
    gap: 2,
  },
  name: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  owned: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  seller: {
    ...theme.typography.caption,
    color: theme.colors.accent,
  },
  accessory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  accessoryThumb: {
    width: theme.sizes.outfitAccessoryTile,
    height: theme.sizes.outfitAccessoryTile,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
