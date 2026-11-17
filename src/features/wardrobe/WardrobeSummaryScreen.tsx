import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type {
  CategoryValue,
  CostPerWearItem,
  PairingUnlock,
  UnwornItem,
  WardrobeItemSummary,
  WardrobeOverview,
  WardrobeValue,
} from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { offerIdFromGoPath, openOffer } from '@/features/catalog/buy';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { useWardrobeSummary } from './hooks';
import { slotWords } from './PairingsSection';
import {
  isSmallWardrobe,
  sortCategories,
  summaryViewProps,
  unpricedCount,
  valueCountsSentence,
} from './summary';
import { lines } from '@/utils/a11y';

/**
 * "Dolap özeti": what the wardrobe is worth, what each piece costs per wear and what has never been worn. Everything
 * the user did not price themselves is labelled "tahmini". No filled button: the screen answers, it does not ask
 * (a small wardrobe is the exception: its one action is adding a piece).
 */
export function WardrobeSummaryScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/wardrobe'));
  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="arrowLeft" label={tr.back} onPress={back} testID="summary-back" />
        <Text style={styles.title} accessibilityRole="header">
          {tr.wardrobeSummaryTitle}
        </Text>
      </View>
      {isSignedIn ? (
        <SignedInSummary />
      ) : (
        <EmptyState
          title={tr.wardrobeSignedOutTitle}
          body={tr.wardrobeSignedOutBody}
          action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
        />
      )}
    </Screen>
  );
}

function SignedInSummary() {
  const summary = useWardrobeSummary();
  const data = summary.data;

  // One `wardrobe_summary_view` per opening of the screen, when the answer is on it.
  const viewed = useRef(false);
  useEffect(() => {
    if (data && !viewed.current) {
      viewed.current = true;
      track('wardrobe_summary_view', summaryViewProps(data));
    }
  }, [data]);

  if (summary.isPending) {
    return <SummarySkeleton />;
  }
  if (summary.isError || !data) {
    const offline = summary.error instanceof ApiError && summary.error.isNetworkError;
    return (
      <ErrorState
        body={offline ? tr.errorNetwork : tr.wardrobeSummaryLoadFailed}
        error={summary.error}
        onRetry={() => void summary.refetch()}
      />
    );
  }
  return isSmallWardrobe(data) ? (
    <SmallWardrobe overview={data} />
  ) : (
    <FullSummary overview={data} />
  );
}

/** Fewer pieces than the summary needs: the backend's sentence and the one way forward. No figures at all. */
function SmallWardrobe({ overview }: { overview: WardrobeOverview }) {
  const router = useRouter();
  return (
    <View style={styles.small} testID="summary-small">
      <Text style={styles.body} testID="summary-small-message">
        {overview.message}
      </Text>
      <Button
        label={tr.wardrobeSummaryAdd}
        onPress={() => router.navigate('/wardrobe')}
        testID="summary-add"
      />
    </View>
  );
}

function FullSummary({ overview }: { overview: WardrobeOverview }) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      testID="summary-full"
    >
      {overview.value ? <ValueSection value={overview.value} /> : null}
      <CostPerWearSection items={overview.costPerWear ?? []} />
      {overview.unworn ? <UnwornSection unworn={overview.unworn} /> : null}
    </ScrollView>
  );
}

function Estimated({ testID }: { testID?: string }) {
  return (
    <Text style={styles.estimated} testID={testID}>
      {tr.wardrobeEstimated}
    </Text>
  );
}

function ValueSection({ value }: { value: WardrobeValue }) {
  const router = useRouter();
  const total = value.total === null ? null : toNumber(value.total);
  const counts = valueCountsSentence(value.counts);
  const unpriced = unpricedCount(value);
  const categories = sortCategories(value.byCategory);

  return (
    <View style={styles.section} testID="summary-value">
      <View style={styles.hero}>
        <Text style={styles.caption}>{tr.wardrobeValueLabel}</Text>
        {total !== null ? (
          <View
            style={styles.heroRow}
            accessible
            accessibilityLabel={[
              tr.wardrobeValueLabel,
              value.isEstimate ? tr.wardrobeEstimated : null,
              formatTry(total),
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <Text style={styles.heroPrice} testID="summary-total">
              {formatTry(total)}
            </Text>
            {value.isEstimate ? <Estimated testID="summary-total-estimated" /> : null}
          </View>
        ) : null}
      </View>

      {counts ? (
        <Text style={styles.body} testID="summary-counts">
          {counts}
        </Text>
      ) : null}
      {unpriced > 0 ? (
        <Button
          label={tr.wardrobeValueAddPrices}
          variant="quiet"
          trailingIcon="arrowRight"
          onPress={() => router.navigate('/wardrobe')}
          style={styles.link}
          testID="summary-unpriced"
        />
      ) : null}
      {value.note ? (
        <Text style={styles.muted} testID="summary-note">
          {value.note}
        </Text>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.list} testID="summary-categories">
          <Text style={styles.subhead} accessibilityRole="header">
            {tr.wardrobeValueByCategory}
          </Text>
          {categories.map((category) => (
            <CategoryRow key={category.slug ?? 'none'} category={category} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CategoryRow({ category }: { category: CategoryValue }) {
  const total = category.total === null ? null : toNumber(category.total);
  const pieces = tr.wardrobeCategoryPieces(toNumber(category.pieceCount));
  const amount = total === null ? tr.wardrobeCategoryNoPrice : formatTry(total);
  const estimated = total !== null && category.isEstimate;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[category.name, pieces, estimated ? tr.wardrobeEstimated : null, amount]
        .filter(Boolean)
        .join(', ')}
      testID={`summary-category-${category.slug ?? 'none'}`}
    >
      <View style={styles.rowText}>
        <Text style={styles.name}>{category.name}</Text>
        <Text style={styles.muted}>{pieces}</Text>
      </View>
      <View style={styles.amount}>
        <Text style={total === null ? styles.muted : styles.price}>{amount}</Text>
        {estimated ? (
          <Estimated testID={`summary-category-estimated-${category.slug ?? 'none'}`} />
        ) : null}
      </View>
    </View>
  );
}

function CostPerWearSection({ items }: { items: CostPerWearItem[] }) {
  return (
    <View style={styles.section} testID="summary-cpw">
      <Text style={styles.subhead} accessibilityRole="header">
        {tr.wardrobeCostPerWearTitle}
      </Text>
      <Text style={styles.body}>
        {items.length > 0 ? tr.wardrobeCostPerWearBody : tr.wardrobeCostPerWearEmpty}
      </Text>
      {items.length > 0 ? (
        <View style={styles.list}>
          {items.map((entry) => (
            <CostPerWearRow key={entry.item.id} entry={entry} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CostPerWearRow({ entry }: { entry: CostPerWearItem }) {
  const router = useRouter();
  const name = entry.item.name ?? tr.wardrobeItemUnnamed;
  const caption = [
    tr.wardrobeCostPerWearCount(toNumber(entry.wearCount)),
    entry.priceIsEstimate ? tr.wardrobeCostPerWearEstimated : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const cost = formatTry(entry.costPerWear);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${caption}, ${cost} ${tr.wardrobeCostPerWearUnit}`}
      onPress={() => router.push(`/wardrobe/${entry.item.id}`)}
      style={styles.row}
      testID={`summary-cpw-${entry.item.id}`}
    >
      <Thumb item={entry.item} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={lines(2)}>
          {name}
        </Text>
        <Text style={styles.muted} testID={`summary-cpw-caption-${entry.item.id}`}>
          {caption}
        </Text>
      </View>
      <View style={styles.amount}>
        <Text style={styles.price}>{cost}</Text>
        <Text style={styles.muted}>{tr.wardrobeCostPerWearUnit}</Text>
      </View>
    </Pressable>
  );
}

function UnwornSection({ unworn }: { unworn: WardrobeOverview['unworn'] & object }) {
  const total = toNumber(unworn.totalCount);
  return (
    <View style={styles.section} testID="summary-unworn">
      <Text style={styles.subhead} accessibilityRole="header">
        {tr.wardrobeUnwornTitle}
      </Text>
      {total > 0 ? (
        <Text style={styles.body} testID="summary-unworn-lead">
          {tr.wardrobeUnwornLead(total)}
        </Text>
      ) : null}
      {unworn.message ? (
        <Text style={total > 0 ? styles.muted : styles.body} testID="summary-unworn-message">
          {unworn.message}
        </Text>
      ) : null}
      {unworn.items.length > 0 ? (
        <View style={styles.list}>
          {unworn.items.map((entry) => (
            <UnwornRow key={entry.item.id} entry={entry} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function UnwornRow({ entry }: { entry: UnwornItem }) {
  const router = useRouter();
  const name = entry.item.name ?? tr.wardrobeItemUnnamed;
  const days = tr.wardrobeUnwornDays(toNumber(entry.daysInWardrobe));
  return (
    <View style={styles.unworn} testID={`summary-unworn-${entry.item.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[name, days, entry.reasonText].filter(Boolean).join(', ')}
        onPress={() => router.push(`/wardrobe/${entry.item.id}`)}
        style={styles.rowPlain}
        testID={`summary-unworn-open-${entry.item.id}`}
      >
        <Thumb item={entry.item} />
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={lines(2)}>
            {name}
          </Text>
          <Text style={styles.muted}>{days}</Text>
          {entry.reasonText ? (
            <View style={styles.reason}>
              <Text style={styles.reasonText} testID={`summary-reason-${entry.item.id}`}>
                {entry.reasonText}
              </Text>
            </View>
          ) : null}
        </View>
        <Icon name="chevronRight" size={18} color={theme.colors.muted} />
      </Pressable>
      {entry.unlock ? <UnlockRow itemId={entry.item.id} unlock={entry.unlock} /> : null}
    </View>
  );
}

/** The catalog piece that would give the unworn one a partner: a dashed thumbnail (a piece the wardrobe lacks), price, seller, buy. */
function UnlockRow({ itemId, unlock }: { itemId: string; unlock: PairingUnlock }) {
  const price = formatTry(unlock.lowestPrice);
  const seller = unlock.cheapestSeller.name;
  return (
    <View style={styles.unlock} testID={`summary-unlock-${itemId}`}>
      <Text style={styles.muted}>
        {tr.pairingsUnlockTitle(slotWords[unlock.slot], toNumber(unlock.unlocksEstimate))}
      </Text>
      <View style={styles.unlockRow}>
        <View style={styles.unlockThumb}>
          {unlock.imageUrl ? (
            <AppImage uri={unlock.imageUrl} style={styles.fill} contentFit="cover" />
          ) : (
            <Icon name="shirt" size={20} color={theme.colors.control} strokeWidth={1.4} />
          )}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={lines(2)}>
            {unlock.name}
          </Text>
          <Text style={styles.muted}>{tr.outfitPieceLine(seller, price)}</Text>
        </View>
        <Button
          label={tr.wardrobeUnwornBuy}
          variant="secondary"
          accessibilityLabel={tr.wardrobeUnwornBuyLabel(unlock.name, seller, price)}
          onPress={() =>
            void openOffer(
              { id: offerIdFromGoPath(unlock.goPath) ?? '', goPath: unlock.goPath },
              { source: 'wardrobe_summary' },
            )
          }
          testID={`summary-unlock-buy-${itemId}`}
        />
      </View>
    </View>
  );
}

function Thumb({ item }: { item: WardrobeItemSummary }) {
  return (
    <View style={styles.thumb}>
      {item.thumbUrl ? (
        <AppImage uri={item.thumbUrl} style={styles.fill} contentFit="contain" />
      ) : (
        <Icon name="shirt" size={24} color={theme.colors.control} strokeWidth={1.4} />
      )}
    </View>
  );
}

function SummarySkeleton() {
  return (
    <View style={styles.content} testID="summary-skeleton">
      <Skeleton width="40%" height={16} radius={theme.radius.tag} />
      <Skeleton width="60%" height={44} radius={theme.radius.tag} />
      <Skeleton width="90%" height={18} radius={theme.radius.tag} />
      <Skeleton width="100%" height={56} radius={theme.radius.tile} />
      <Skeleton width="100%" height={56} radius={theme.radius.tile} />
      <Skeleton width="100%" height={56} radius={theme.radius.tile} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.ink,
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.xxl,
  },
  small: {
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.xl,
  },
  section: {
    gap: theme.spacing.md,
  },
  hero: {
    gap: theme.spacing.xs,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing.sm,
  },
  heroPrice: {
    ...theme.typography.priceHero,
    color: theme.colors.ink,
  },
  estimated: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  subhead: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  muted: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  link: {
    alignSelf: 'flex-start',
    marginLeft: -theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.xs,
  },
  row: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
  },
  rowPlain: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  price: {
    ...theme.typography.price,
    color: theme.colors.ink,
  },
  amount: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  thumb: {
    width: theme.sizes.tagThumb,
    height: theme.sizes.tagThumb,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  unworn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
    paddingBottom: theme.spacing.sm,
  },
  reason: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.tag,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
  reasonText: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  unlock: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  unlockRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  // A piece the wardrobe lacks wears the chalk dashed edge everywhere in the app.
  unlockThumb: {
    width: theme.sizes.tagThumb,
    height: theme.sizes.tagThumb,
    borderRadius: theme.radius.control,
    borderWidth: theme.sizes.dashedBorder,
    borderStyle: 'dashed',
    borderColor: theme.colors.chalkLine,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
