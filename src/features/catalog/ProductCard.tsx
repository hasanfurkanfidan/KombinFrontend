import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProductListItem } from '@/api/models';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { SaveButton } from '@/features/saved/SaveButton';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { matchBadgeScore } from './matchBadge';

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

export function ProductCard({ product, width, onPress }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const price = toNumber(product.lowestPrice);
  const originalPrice =
    product.lowestOriginalPrice === null ? null : toNumber(product.lowestOriginalPrice);
  const discount = toNumber(product.discountPercent);
  const offerCount = toNumber(product.offerCount);
  const showImage = Boolean(product.primaryImageUrl) && !imageFailed;
  const match = matchBadgeScore(product.matchScore);
  const inactive = product.isActive === false;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.brand.name}, ${product.name}, ${formatTry(price)}`}
      onPress={() => onPress(product.id)}
      style={[styles.card, { width }]}
      testID={`product-card-${product.id}`}
    >
      <View style={styles.imageBox}>
        {showImage ? (
          <Image
            source={{ uri: product.primaryImageUrl ?? undefined }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon name="shirt" size={48} color={theme.colors.borderStrong} strokeWidth={1.4} />
        )}
        {discount > 0 ? (
          <View style={styles.discountPill}>
            <Text style={styles.discountText}>{`−${discount}%`}</Text>
          </View>
        ) : null}
        {match !== null ? (
          <View style={styles.matchPill} testID={`match-badge-${product.id}`}>
            <Text style={styles.matchText}>{tr.productMatch(match)}</Text>
          </View>
        ) : null}
        {inactive ? (
          <View style={styles.inactiveOverlay} testID={`inactive-${product.id}`}>
            <Text style={styles.inactiveText}>{tr.trackSavedInactive}</Text>
          </View>
        ) : null}
        <SaveButton productId={product.id} variant="card" style={styles.save} />
      </View>
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand.name}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price} numberOfLines={1}>
            {formatTry(price)}
          </Text>
          {originalPrice !== null && originalPrice > price ? (
            <Text style={styles.originalPrice} numberOfLines={1}>
              {formatTry(originalPrice)}
            </Text>
          ) : null}
        </View>
        {offerCount > 1 ? (
          <Text style={styles.footer} numberOfLines={1}>
            {product.cheapestSeller
              ? tr.productCardCheapestFrom(product.cheapestSeller.name, offerCount)
              : tr.productCardCheapest(offerCount)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm,
  },
  imageBox: {
    height: theme.sizes.productImageHeight,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceAlt,
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
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  discountText: {
    ...theme.typography.captionMedium,
    color: theme.colors.onInk,
  },
  matchPill: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  matchText: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  save: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: theme.spacing.md,
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  inactiveText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
    textAlign: 'center',
  },
  info: {
    gap: 2,
  },
  brand: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  name: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  price: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  originalPrice: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    textDecorationLine: 'line-through',
  },
  footer: {
    ...theme.typography.caption,
    color: theme.colors.accent,
  },
});
