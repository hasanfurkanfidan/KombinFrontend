import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { useActivePersona, usePersonas } from '@/features/personas/hooks';
import { PersonaChips } from '@/features/personas/PersonaChips';
import { useMe } from '@/features/profile/hooks';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatLongDay } from '@/utils/dates';

import { FilterBar } from './FilterBar';
import { hasActiveFilters, parseFilters, withPersona, type ProductFilters } from './filters';
import { buildGreeting } from './greeting';
import { useProducts } from './hooks';
import { ProductGrid, ProductGridSkeleton } from './ProductGrid';

export function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string;
    color?: string;
    audience?: string;
    sort?: string;
  }>();
  const { category, color, audience, sort } = params;

  // The URL search params are the single source of truth, so the back stack restores the filters.
  const filters = useMemo(
    () => parseFilters({ category, color, audience, sort }),
    [category, color, audience, sort],
  );
  const setFilters = (next: ProductFilters) =>
    router.setParams({
      category: next.categorySlug ?? '',
      color: next.color ?? '',
      audience: next.audience ?? '',
      sort: next.sort ?? '',
    });

  // Signed-in users wait for their personas, so the list is fetched once, already scored for the active one.
  const { isSignedIn } = useSession();
  const personas = usePersonas();
  const personaId = useActivePersona()?.id;
  const personasReady = !isSignedIn || !personas.isPending;
  const products = useProducts(withPersona(filters, personaId), personasReady);
  const items = useMemo(
    () => products.data?.pages.flatMap((page) => page.items) ?? [],
    [products.data],
  );

  const header = (
    <DiscoverHeader filters={filters} onChangeFilters={setFilters} personaId={personaId} />
  );

  let placeholder = <ProductGridSkeleton />;
  if (products.isError && !products.isFetchingNextPage && items.length === 0) {
    placeholder = <ErrorState onRetry={() => void products.refetch()} />;
  } else if (!products.isPending && personasReady && items.length === 0) {
    placeholder = (
      <EmptyState
        title={tr.discoverEmptyTitle}
        body={tr.discoverEmptyBody}
        action={
          hasActiveFilters(filters)
            ? {
                label: tr.discoverClearFilters,
                onPress: () => setFilters({}),
              }
            : undefined
        }
      />
    );
  }

  const footer =
    products.isFetchNextPageError && items.length > 0 ? (
      <View style={styles.loadMoreFailed}>
        <Text style={styles.loadMoreFailedText}>{tr.discoverLoadMoreFailed}</Text>
        <Button
          label={tr.retry}
          variant="secondary"
          onPress={() => void products.fetchNextPage()}
        />
      </View>
    ) : null;

  return (
    <Screen padded={false}>
      <ProductGrid
        items={items}
        onPressItem={(id) => router.push(`/product/${id}`)}
        header={header}
        placeholder={placeholder}
        footer={footer}
        isFetchingNextPage={products.isFetchingNextPage}
        onEndReached={() => {
          if (
            products.hasNextPage &&
            !products.isFetchingNextPage &&
            !products.isFetchNextPageError
          ) {
            void products.fetchNextPage();
          }
        }}
        refreshing={products.isRefetching && !products.isFetchingNextPage}
        onRefresh={() => void products.refetch()}
      />
    </Screen>
  );
}

interface DiscoverHeaderProps {
  filters: ProductFilters;
  onChangeFilters: (next: ProductFilters) => void;
  personaId: string | undefined;
}

function DiscoverHeader({ filters, onChangeFilters, personaId }: DiscoverHeaderProps) {
  const me = useMe();
  const now = new Date();

  return (
    <View style={styles.header}>
      <View style={styles.greetingRow}>
        <View style={styles.greeting}>
          <Text style={styles.date}>{formatLongDay(now)}</Text>
          <Text style={styles.hello} numberOfLines={1}>
            {buildGreeting(now, me.data?.displayName)}
          </Text>
        </View>
        <IconButton icon="bell" label={tr.comingSoon} tone="tinted" />
      </View>

      <PersonaChips />
      {/* Placeholder: the "tomorrow" card arrives with the outfit features. */}
      <View style={styles.tomorrow}>
        <View style={styles.tomorrowText}>
          <Text style={styles.tomorrowLabel}>{tr.discoverTomorrowLabel}</Text>
          <Text style={styles.tomorrowTitle}>{tr.discoverTomorrowTitle}</Text>
        </View>
        <View style={styles.soon}>
          <Text style={styles.soonText}>{tr.comingSoon}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{tr.discoverForYou}</Text>
      <View style={styles.filters}>
        <FilterBar filters={filters} onChange={onChangeFilters} personaId={personaId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.lg,
  },
  greeting: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  date: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  hello: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  tomorrow: {
    marginHorizontal: theme.screenPaddingX,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xxl,
    backgroundColor: theme.colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  tomorrowText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  tomorrowLabel: {
    ...theme.typography.overline,
    color: theme.colors.borderStrong,
  },
  tomorrowTitle: {
    ...theme.typography.headingLarge,
    color: theme.colors.onInk,
  },
  soon: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkSoft,
  },
  soonText: {
    ...theme.typography.captionMedium,
    color: theme.colors.onInk,
  },
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.ink,
    paddingHorizontal: theme.screenPaddingX,
    marginTop: theme.spacing.sm,
  },
  filters: {
    marginTop: -theme.spacing.xs,
  },
  loadMoreFailed: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  loadMoreFailedText: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
});
