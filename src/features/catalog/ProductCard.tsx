import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ProductListItem } from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { tr } from '@/i18n/tr';
import { SaveButton } from '@/features/saved/SaveButton';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { matchBadgeScore } from './matchBadge';
import { lines } from '@/utils/a11y';

/** What a card needs: a list item, or a saved product (no match score, but it may be off the market). */
export type CardProduct = Omit<ProductListItem, 'matchScore'> & {
  matchScore?: ProductListItem['matchScore'];
  isActive?: boolean;
};

interface ProductCardProps {
  product: CardProduct;
  width: number;
  onPress: (id: string) => void;
}

/**
 * Memoised: a grid re-renders on every page fetch, refetch and (on the search screen) keystroke; a card re-renders only
 * when its product, width or `onPress` changes. Callers pass a stable `onPress` (`ProductGrid` does it for them).
 */
export const ProductCard = memo(function ProductCard({
  product,
  width,
  onPress,
}: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const price = toNumber(product.lowestPrice);
  const originalPrice =
    product.lowestOriginalPrice === null ? null : toNumber(product.lowestOriginalPrice);
  const discount = toNumber(product.discountPercent);
  const offerCount = toNumber(product.offerCount);
  const showImage = Boolean(product.primaryImageUrl) && !imageFailed;
  const match = matchBadgeScore(product.matchScore);
  const inactive = product.isActive === false;
  // The button's name replaces its contents for a screen reader, so it carries everything the card shows.
  const spoken = [
    product.brand.name,
    product.name,
    formatTry(price),
    discount > 0 ? tr.discountBadge(discount) : null,
    match !== null ? tr.productMatch(match) : null,
    offerCount > 1
      ? product.cheapestSeller
        ? tr.productCardCheapestFrom(product.cheapestSeller.name, offerCount)
        : tr.productCardCheapest(offerCount)
      : null,
    inactive ? tr.trackSavedInactive : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    // The bookmark is a sibling of the card's button, not inside it: an accessible parent hides its children on iOS.
    <View style={{ width }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={spoken}
        onPress={() => onPress(product.id)}
        style={styles.card}
        testID={`product-card-${product.id}`}
      >
        <View style={styles.imageBox}>
          {showImage ? (
            <AppImage
              uri={product.primaryImageUrl ?? ''}
              style={styles.image}
              contentFit="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Icon name="shirt" size={48} color={theme.colors.control} strokeWidth={1.4} />
          )}
          {discount > 0 ? (
            <View style={styles.discountPill}>
              <Text style={styles.discountText}>{tr.discountBadge(discount)}</Text>
            </View>
          ) : null}
          {inactive ? (
            <View style={styles.inactiveOverlay} testID={`inactive-${product.id}`}>
              <Text style={styles.inactiveText}>{tr.trackSavedInactive}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.info}>
          <Text style={styles.brand} numberOfLines={lines(1)}>
            {product.brand.name}
          </Text>
          <Text style={styles.name} numberOfLines={lines(2)}>
            {product.name}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatTry(price)}</Text>
            {originalPrice !== null && originalPrice > price ? (
              <Text style={styles.originalPrice}>{formatTry(originalPrice)}</Text>
            ) : null}
          </View>
          {/* Under the price, not on the image: the discount badge owns the photo's corner. */}
          {match !== null ? (
            <Text
              style={styles.match}
              numberOfLines={lines(1)}
              testID={`match-badge-${product.id}`}
            >
              {tr.productMatch(match)}
            </Text>
          ) : null}
          {offerCount > 1 ? (
            <Text style={styles.footer} numberOfLines={lines(1)}>
              {product.cheapestSeller
                ? tr.productCardCheapestFrom(product.cheapestSeller.name, offerCount)
                : tr.productCardCheapest(offerCount)}
            </Text>
          ) : null}
        </View>
      </PressableScale>
      <SaveButton productId={product.id} variant="card" style={styles.save} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm,
  },
  imageBox: {
    height: theme.sizes.productImageHeight,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  discountPill: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: theme.colors.chalk,
    borderRadius: theme.radius.tag,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  discountText: {
    ...theme.typography.match,
    color: theme.colors.chalkInk,
  },
  // Drawn over the photo's bottom right corner, from the card's own corner.
  save: {
    position: 'absolute',
    right: theme.spacing.md,
    top: theme.sizes.productImageHeight - theme.spacing.md - theme.sizes.bookmarkButton,
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  inactiveText: {
    ...theme.typography.label,
    color: theme.colors.onImage,
    textAlign: 'center',
  },
  info: {
    gap: 2,
  },
  brand: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  name: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  // Wraps instead of cutting: the original price drops to the next line on a narrow card.
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing.sm,
  },
  price: {
    ...theme.typography.price,
    color: theme.colors.ink,
  },
  originalPrice: {
    ...theme.typography.caption,
    fontVariant: ['tabular-nums'],
    color: theme.colors.muted,
    textDecorationLine: 'line-through',
  },
  match: {
    ...theme.typography.match,
    color: theme.colors.primary,
  },
  footer: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});
