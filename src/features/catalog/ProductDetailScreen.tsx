import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type { Offer, Product } from '@/api/models';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { AlertSheet } from '@/features/alerts/AlertSheet';
import { useHasAlert } from '@/features/alerts/hooks';
import { PushPrimerSheet, usePushPrimer } from '@/features/alerts/PushPrimer';
import { useActivePersona, usePersonas } from '@/features/personas/hooks';
import { SaveButton } from '@/features/saved/SaveButton';
import { sizePill } from '@/features/sizes/sizeHint';
import { SizeSheet } from '@/features/sizes/SizeSheet';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatTry } from '@/utils/money';
import { withAblative } from '@/utils/turkish';

import { openOffer } from './buy';
import { usePriceHistory, useProduct } from './hooks';
import { matchBadgeScore } from './matchBadge';
import { isSellable, OfferRow } from './OfferRow';
import { buildPricePoints } from './priceHistory';
import type { ProductSource } from './productLink';
import { PriceSummary } from './PriceSummary';

const BAR_PADDING = theme.spacing.md;

interface ProductDetailScreenProps {
  id: string;
  /** Where the user came from, reported with `product_view`. */
  source?: ProductSource;
}

export function ProductDetailScreen({ id, source = 'direct' }: ProductDetailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useSession();
  // Signed-in users wait for their personas so the detail is fetched once, already scored for the active one.
  const personas = usePersonas();
  const personaId = useActivePersona()?.id;
  const product = useProduct(id, personaId, !isSignedIn || !personas.isPending);
  const history = usePriceHistory(id);
  const hasAlert = useHasAlert(id);
  const pushPrimer = usePushPrimer();
  const [alertOpen, setAlertOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  // One `product_view` per opened detail, once the product (and so the persona it was scored for) is known.
  const viewedId = useRef<string | null>(null);
  const loadedId = product.data?.id;
  useEffect(() => {
    if (loadedId && viewedId.current !== loadedId) {
      viewedId.current = loadedId;
      track('product_view', { productId: loadedId, personaId, source });
    }
  }, [loadedId, personaId, source]);

  const points = useMemo(
    () => (history.data ? buildPricePoints(history.data) : []),
    [history.data],
  );
  const historyState = {
    status: history.isError ? 'error' : history.isPending ? 'loading' : 'ready',
    points,
  } as const;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const buy = (offer: Offer) => openOffer(offer, { source: 'product_detail', personaId });
  const requireSignIn = (action: () => void) => (isSignedIn ? action() : router.push('/login'));

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
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <View style={styles.brandRow}>
                  <Text style={styles.brand}>{product.data.brand.name}</Text>
                  <MatchPill score={product.data.matchScore} />
                </View>
                <Text style={styles.name}>{product.data.name}</Text>
              </View>
              <SizeSlot
                product={product.data}
                onAdd={() => requireSignIn(() => setSizeOpen(true))}
              />
            </View>
            <PriceSummary summary={product.data.priceSummary} history={historyState} />
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                requireSignIn(() =>
                  router.push(`/outfits/how-to-wear?productId=${product.data.id}`),
                )
              }
              style={styles.howToWear}
              testID="how-to-wear"
            >
              <View style={styles.howToWearText}>
                <Text style={styles.howToWearTitle}>{tr.productHowToWear}</Text>
                <Text style={styles.howToWearCaption}>{tr.productHowToWearCaption}</Text>
              </View>
              <Icon name="chevronRight" size={20} color={theme.colors.inkMuted} />
            </Pressable>
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
                        onPress={buy}
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
        {product.data ? (
          <IconButton
            icon="bell"
            label={hasAlert ? tr.productAlertActive : tr.productAlertBell}
            filled={hasAlert}
            onPress={() => requireSignIn(() => setAlertOpen(true))}
            testID="detail-bell"
          />
        ) : null}
      </View>

      {product.data ? (
        <View style={[styles.bar, { paddingBottom: BAR_PADDING + insets.bottom }]}>
          <SaveButton productId={product.data.id} variant="bar" />
          {cheapest ? (
            <Button
              label={tr.productBuy(
                withAblative(cheapest.seller.name),
                formatTry(cheapest.currentPrice),
              )}
              trailingIcon="arrowUpRight"
              onPress={() => void buy(cheapest)}
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

      {product.data ? (
        <>
          <AlertSheet
            visible={alertOpen}
            onClose={() => setAlertOpen(false)}
            product={product.data}
            onCreated={() => void pushPrimer.maybePrompt()}
          />
          <SizeSheet
            visible={sizeOpen}
            onClose={() => setSizeOpen(false)}
            initial={{
              brand: { slug: product.data.brand.slug, name: product.data.brand.name },
              group: product.data.sizeHint?.group,
            }}
          />
          <PushPrimerSheet
            visible={pushPrimer.visible}
            onAllow={() => void pushPrimer.allow()}
            onDismiss={pushPrimer.dismiss}
          />
        </>
      ) : null}
    </View>
  );
}

/** "Sana uygun %94" next to the brand line; absent without a persona or when the score is too low to show. */
function MatchPill({ score }: { score: Product['matchScore'] }) {
  const value = matchBadgeScore(score);
  if (value === null) {
    return null;
  }
  return (
    <View style={styles.matchPill} testID="detail-match">
      <Text style={styles.matchText}>{tr.productMatch(value)}</Text>
    </View>
  );
}

/** Top-right of the title block: the user's size as a pill, a guess written out, or a link to add one. */
function SizeSlot({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const pill = sizePill(product.sizeHint);
  if (pill.kind === 'none') {
    return (
      <Pressable
        accessibilityRole="link"
        onPress={onAdd}
        hitSlop={theme.spacing.sm}
        testID="size-add"
      >
        <Text style={styles.sizeLink}>{tr.productSizeAdd}</Text>
      </Pressable>
    );
  }
  if (pill.kind === 'inferred') {
    return (
      <View style={styles.sizeSlot} testID="size-pill-inferred">
        <Text style={styles.sizeGuess}>{tr.productSizeInferred(pill.size)}</Text>
        {pill.unsure ? (
          <Text style={styles.sizeCaption} testID="size-unsure">
            {tr.productSizeUnsure}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.sizeSlot} testID="size-pill">
      <Text style={styles.sizeCaption}>{tr.productSizeYours}</Text>
      <View style={styles.sizePill}>
        <Text style={styles.sizePillText}>{pill.size}</Text>
      </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  brand: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  matchPill: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  matchText: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  sizeSlot: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  sizeCaption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  sizePill: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
  },
  sizePillText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
  },
  sizeGuess: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  sizeLink: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
    textDecorationLine: 'underline',
  },
  name: {
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
  howToWear: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
  },
  howToWearText: {
    flex: 1,
    gap: 2,
  },
  howToWearTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  howToWearCaption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
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
