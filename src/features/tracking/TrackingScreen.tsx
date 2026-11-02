import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useAlerts, useTriggers } from '@/features/alerts/hooks';
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductGrid';
import { productHref } from '@/features/catalog/productLink';
import { useSavedProducts } from '@/features/saved/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatTry } from '@/utils/money';
import { withPossessive } from '@/utils/turkish';

import { AlertRow } from './AlertRow';
import { SegmentedControl } from './SegmentedControl';
import { averageDiscountPercent, totalSavings, watchSummary } from './stats';

type Segment = 'alerts' | 'saved';

const SEGMENTS = [
  { value: 'alerts', label: tr.trackSegmentAlerts },
  { value: 'saved', label: tr.trackSegmentSaved },
] as const;

/** The Takip tab (design screen 10): price alerts with headline stats, and the saved products grid. */
export function TrackingScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const [segment, setSegment] = useState<Segment>('alerts');

  if (!isSignedIn) {
    return (
      <Screen>
        <Text style={styles.title}>{tr.tabTracking}</Text>
        <EmptyState
          title={tr.trackSignedOutTitle}
          body={tr.trackSignedOutBody}
          action={{ label: tr.login, onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      {segment === 'alerts' ? (
        <AlertsSection segment={segment} onChangeSegment={setSegment} />
      ) : (
        <SavedSection segment={segment} onChangeSegment={setSegment} />
      )}
    </Screen>
  );
}

interface SectionProps {
  segment: Segment;
  onChangeSegment: (segment: Segment) => void;
}

function AlertsSection({ segment, onChangeSegment }: SectionProps) {
  const router = useRouter();
  const alerts = useAlerts();
  const triggers = useTriggers();
  const now = useMemo(() => new Date(), []);

  const alertItems = alerts.data;
  const triggerItems = useMemo(() => triggers.data ?? [], [triggers.data]);
  const summary = useMemo(() => watchSummary(alertItems ?? []), [alertItems]);
  const savings = useMemo(() => totalSavings(triggerItems), [triggerItems]);
  const averageDiscount = useMemo(() => averageDiscountPercent(triggerItems), [triggerItems]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{tr.tabTracking}</Text>
      {alertItems ? (
        <Text style={styles.summary} testID="track-summary">
          {tr.trackSummary(summary.watched, withPossessive(summary.belowTarget))}
        </Text>
      ) : null}
      <View style={styles.stats}>
        <View style={[styles.stat, styles.statAccent]}>
          <Text style={[styles.statValue, styles.statValueAccent]} testID="track-savings">
            {formatTry(savings)}
          </Text>
          <Text style={styles.statLabelAccent}>{tr.trackSavings}</Text>
        </View>
        {averageDiscount !== null ? (
          <View style={styles.stat}>
            <Text style={styles.statValue} testID="track-average">
              {`%${Math.round(averageDiscount)}`}
            </Text>
            <Text style={styles.statLabel}>{tr.trackAvgDiscount}</Text>
          </View>
        ) : null}
      </View>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={onChangeSegment} />
    </View>
  );

  return (
    <FlatList
      data={alertItems ?? []}
      keyExtractor={(alert) => alert.id}
      renderItem={({ item }) => (
        <AlertRow
          alert={item}
          triggers={triggerItems}
          now={now}
          onOpen={(productId) => router.push(productHref(productId, 'alert'))}
        />
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={
        alerts.isError ? (
          <ErrorState body={tr.trackLoadFailed} onRetry={() => void alerts.refetch()} />
        ) : alerts.isPending ? (
          <View style={styles.skeletons}>
            <Skeleton height={104} radius={theme.radius.xl} />
            <Skeleton height={104} radius={theme.radius.xl} />
          </View>
        ) : (
          <EmptyState title={tr.trackEmptyAlertsTitle} body={tr.trackEmptyAlertsBody} />
        )
      }
      contentContainerStyle={styles.listContent}
      refreshing={alerts.isRefetching}
      onRefresh={() => {
        void alerts.refetch();
        void triggers.refetch();
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function SavedSection({ segment, onChangeSegment }: SectionProps) {
  const router = useRouter();
  const saved = useSavedProducts();
  const items = useMemo(() => saved.data?.pages.flatMap((page) => page.items) ?? [], [saved.data]);

  const header = (
    <View style={[styles.header, styles.headerPadded]}>
      <Text style={styles.title}>{tr.tabTracking}</Text>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={onChangeSegment} />
    </View>
  );

  return (
    <ProductGrid
      items={items}
      onPressItem={(id) => router.push(productHref(id, 'saved'))}
      header={header}
      placeholder={
        saved.isError ? (
          <ErrorState body={tr.trackLoadFailed} onRetry={() => void saved.refetch()} />
        ) : saved.isPending ? (
          <ProductGridSkeleton />
        ) : (
          <EmptyState title={tr.trackEmptySavedTitle} body={tr.trackEmptySavedBody} />
        )
      }
      isFetchingNextPage={saved.isFetchingNextPage}
      onEndReached={() => {
        if (saved.hasNextPage && !saved.isFetchingNextPage) {
          void saved.fetchNextPage();
        }
      }}
      refreshing={saved.isRefetching && !saved.isFetchingNextPage}
      onRefresh={() => void saved.refetch()}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg,
  },
  headerPadded: {
    paddingHorizontal: theme.screenPaddingX,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
    paddingTop: theme.spacing.lg,
  },
  summary: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  stats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  stat: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
    gap: theme.spacing.xs,
  },
  statAccent: {
    backgroundColor: theme.colors.accentSoft,
  },
  statValue: {
    ...theme.typography.priceLarge,
    color: theme.colors.ink,
  },
  statValueAccent: {
    color: theme.colors.accent,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  statLabelAccent: {
    ...theme.typography.caption,
    color: theme.colors.accent,
  },
  listContent: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
  },
  separator: {
    height: theme.spacing.md,
  },
  skeletons: {
    gap: theme.spacing.md,
  },
});
