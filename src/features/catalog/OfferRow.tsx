import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Offer } from '@/api/models';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatAmount, formatTry, toNumber } from '@/utils/money';

export function isSellable(offer: Pick<Offer, 'stockStatus'>): boolean {
  return offer.stockStatus === 'InStock' || offer.stockStatus === 'LowStock';
}

type CaptionTone = 'accent' | 'muted' | 'warning';

/** The line under the seller name: sold out, free shipping or the shipping fee. Null when shipping is unknown. */
export function getOfferCaption(offer: Offer): { text: string; tone: CaptionTone } | null {
  if (offer.stockStatus === 'OutOfStock') {
    return { text: tr.offerOutOfStock, tone: 'warning' };
  }
  if (offer.shippingCost === null) {
    return null;
  }
  // `effectivePrice` already folds in the free-shipping threshold, so the difference is what is really paid.
  const shipping = toNumber(offer.effectivePrice) - toNumber(offer.currentPrice);
  return shipping > 0
    ? { text: tr.offerShipping(formatAmount(shipping)), tone: 'muted' }
    : { text: tr.offerFreeShipping, tone: 'accent' };
}

interface OfferRowProps {
  offer: Offer;
  /** The cheapest sellable offer is drawn on the tinted background. */
  highlighted: boolean;
  onPress: (offer: Offer) => void;
}

export function OfferRow({ offer, highlighted, onPress }: OfferRowProps) {
  const caption = getOfferCaption(offer);
  const sellable = isSellable(offer);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${offer.seller.name}, ${formatTry(offer.currentPrice)}`}
      disabled={!sellable}
      onPress={() => onPress(offer)}
      style={[styles.row, highlighted && styles.highlighted]}
      testID={`offer-row-${offer.id}`}
    >
      <View style={[styles.badge, highlighted ? styles.badgeStrong : styles.badgeSoft]}>
        <Text style={[styles.badgeText, highlighted && styles.badgeTextStrong]}>
          {offer.seller.name.charAt(0).toLocaleUpperCase('tr-TR')}
        </Text>
      </View>
      <View style={styles.middle}>
        <Text style={styles.seller} numberOfLines={1}>
          {offer.seller.name}
        </Text>
        {caption ? (
          <Text style={[styles.caption, styles[caption.tone]]} numberOfLines={1}>
            {caption.text}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.price, !sellable && styles.priceMuted]} numberOfLines={1}>
        {formatTry(offer.currentPrice)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  highlighted: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  badge: {
    width: theme.sizes.sellerBadge,
    height: theme.sizes.sellerBadge,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStrong: {
    backgroundColor: theme.colors.ink,
  },
  badgeSoft: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  badgeText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  badgeTextStrong: {
    color: theme.colors.onInk,
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  seller: {
    ...theme.typography.bodyStrong,
    fontSize: 14,
    color: theme.colors.ink,
  },
  caption: {
    ...theme.typography.caption,
  },
  accent: {
    color: theme.colors.accent,
  },
  muted: {
    color: theme.colors.inkMuted,
  },
  warning: {
    color: theme.colors.warning,
  },
  price: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
    textAlign: 'right',
  },
  priceMuted: {
    color: theme.colors.inkMuted,
  },
});
