import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Offer, Product } from '@/api/models';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry } from '@/utils/money';
import { withAblative } from '@/utils/turkish';

import { usePriceHistory, useProduct } from './hooks';
import { isSellable, OfferRow } from './OfferRow';
import { buildPricePoints } from './priceHistory';
import { PriceSummary } from './PriceSummary';

const BAR_PADDING = theme.spacing.md;

interface ProductDetailScreenProps {
  id: string;
}

export function ProductDetailScreen({ id }: ProductDetailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = useProduct(id);
  const history = usePriceHistory(id);

  const points = useMemo(
    () => (history.data ? buildPricePoints(history.data) : []),
    [history.data],
  );
  const historyState = {
    status: history.isError ? 'error' : history.isPending ? 'loading' : 'ready',
    points,
  } as const;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openOffer = async (offer: Offer) => {
    try {
      await WebBrowser.openBrowserAsync(offer.url);
    } catch {
      // The in-app browser could not be opened; the offer list stays usable.
    }
  };

  const barHeight = theme.sizes.buttonHeight + BAR_PADDING * 2 + insets.bottom;
  const cheapest = product.data?.offers.find(isSellable);

  return (
    <View style={styles.root}>
      {product.isPending ? (
        <DetailSkeleton />
      ) : product.isError ? (
        <View style={[styles.errorWrap, { paddingTop: insets.top + theme.sizes.touch }]}>
          {product.error instanceof ApiError && product.error.status === 404 ? (
            <ErrorState title={tr.productNotFound} body={tr.productNotFoundBody} />
          ) : (
            <ErrorState onRetry={() => void product.refetch()} />
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: barHeight + theme.spacing.xxl }}
        >
          <ProductImages product={product.data} />
          <View style={styles.body}>
            <View style={styles.titleBlock}>
              <Text style={styles.brand}>{product.data.brand.name}</Text>
              <Text style={styles.name}>{product.data.name}</Text>
            </View>
            <PriceSummary summary={product.data.priceSummary} history={historyState} />
            <View style={styles.offers}>
              <Text style={styles.offersTitle}>
                {tr.productSellersFound(product.data.offers.length)}
              </Text>
              {product.data.offers.length === 0 ? (
                <Text style={styles.noOffers}>{tr.productNoOffers}</Text>
              ) : (
                <View style={styles.offerList}>
                  {product.data.offers.map((offer, index) => (
                    <View key={offer.id} style={index > 0 && styles.offerDivider}>
                      <OfferRow
                        offer={offer}
                        highlighted={offer.id === cheapest?.id}
                        onPress={openOffer}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[styles.topBar, { top: insets.top + theme.spacing.sm }]}>
        <IconButton icon="arrowLeft" label={tr.back} onPress={goBack} testID="detail-back" />
        {product.data ? <IconButton icon="bookmark" label={tr.productSave} /> : null}
      </View>

      {product.data ? (
        <View style={[styles.bar, { paddingBottom: BAR_PADDING + insets.bottom }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.productSave}
            style={styles.saveButton}
          >
            <Icon name="bookmark" size={22} />
          </Pressable>
          {cheapest ? (
            <Button
              label={tr.productBuy(
                withAblative(cheapest.seller.name),
                formatTry(cheapest.currentPrice),
              )}
              trailingIcon="arrowUpRight"
              onPress={() => void openOffer(cheapest)}
              style={styles.buyButton}
              testID="buy-button"
            />
          ) : (
            <Button
              label={tr.productNoStock}
              onPress={() => undefined}
              disabled
              style={styles.buyButton}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function ProductImages({ product }: { product: Product }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const images =
    product.images.length > 0
      ? product.images
      : product.primaryImageUrl
        ? [product.primaryImageUrl]
        : [];

  return (
    <View style={styles.imageArea}>
      {images.length === 0 ? (
        <View style={[styles.imagePlaceholder, { width }]}>
          <Icon name="shirt" size={72} color={theme.colors.borderStrong} strokeWidth={1.2} />
        </View>
      ) : (
        <FlatList
          data={images}
          keyExtractor={(url) => url}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={{ width, height: theme.sizes.detailImageHeight }}
              resizeMode="cover"
            />
          )}
        />
      )}
      {images.length > 1 ? (
        <View
          style={styles.dots}
          accessibilityLabel={tr.productImageCount(index + 1, images.length)}
        >
          {images.map((url, position) => (
            <View key={url} style={[styles.dot, position === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View>
      <Skeleton height={theme.sizes.detailImageHeight} radius={0} />
      <View style={styles.body}>
        <Skeleton height={14} width="25%" radius={theme.radius.sm} />
        <Skeleton height={26} width="80%" radius={theme.radius.sm} />
        <View style={styles.skeletonCards}>
          <Skeleton height={96} radius={theme.radius.lg} style={styles.skeletonCard} />
          <Skeleton height={96} radius={theme.radius.lg} style={styles.skeletonCard} />
        </View>
        <Skeleton height={64} radius={theme.radius.lg} />
        <Skeleton height={64} radius={theme.radius.lg} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: theme.screenPaddingX,
    right: theme.screenPaddingX,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  imageArea: {
    height: theme.sizes.detailImageHeight,
    backgroundColor: theme.colors.surfaceAlt,
  },
  imagePlaceholder: {
    height: theme.sizes.detailImageHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: theme.spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderStrong,
  },
  dotActive: {
    width: 18,
    backgroundColor: theme.colors.ink,
  },
  body: {
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  titleBlock: {
    gap: theme.spacing.xs,
  },
  brand: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  name: {
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
  offers: {
    gap: theme.spacing.md,
  },
  offersTitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.inkSoft,
  },
  noOffers: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  offerList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  offerDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: BAR_PADDING,
    paddingHorizontal: theme.screenPaddingX,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveButton: {
    width: theme.sizes.buttonHeight,
    height: theme.sizes.buttonHeight,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButton: {
    flex: 1,
  },
  skeletonCards: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  skeletonCard: {
    flex: 1,
    width: undefined,
  },
});
