import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { track } from '@/analytics';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { useActivePersona, usePersonas } from '@/features/personas/hooks';
import { StyleSwitcher } from '@/features/personas/StyleSwitcher';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { DailyCard } from '@/features/outfits/DailyCard';
import { useMe } from '@/features/profile/hooks';
import { SearchEntry } from '@/features/search/SearchField';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatLongDay } from '@/utils/dates';

import { FilterBar } from './FilterBar';
import {
  filterNames,
  hasActiveFilters,
  parseFilters,
  withPersona,
  type ProductFilters,
} from './filters';
import { buildGreeting } from './greeting';
import { useProducts } from './hooks';
import { ProductGrid, ProductGridSkeleton } from './ProductGrid';
import { productHref } from './productLink';

/**
 * Keşfet: the product grid. The feed used to be a second section here ("Ürünler / Akış"); it is its own tab now, and
 * an old `?view=feed` link is sent there.
 */
export function DiscoverScreen() {
  const router = useRouter();
  const { view, mode } = useLocalSearchParams<{ view?: string; mode?: string }>();
  const toFeed = view === 'feed';
  useEffect(() => {
    if (toFeed) {
      router.replace({ pathname: '/feed', params: mode === 'following' ? { mode } : {} });
    }
  }, [toFeed, mode, router]);

  return toFeed ? <Screen padded={false}>{null}</Screen> : <ProductsSection />;
}

function ProductsSection() {
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

  // One `product_list_view` per distinct filter set, once its first page is on screen.
  const queryFilters = withPersona(filters, personaId);
  const listKey = `${queryFilters.sort ?? ''}|${filterNames(filters)}`;
  const viewedList = useRef<string | null>(null);
  const listLoaded = products.data !== undefined;
  useEffect(() => {
    if (listLoaded && viewedList.current !== listKey) {
      viewedList.current = listKey;
      track('product_list_view', {
        sort: queryFilters.sort ?? 'relevance',
        filters: filterNames(filters),
      });
    }
    // `queryFilters` and `filters` are derived from `listKey`'s inputs; the key is what decides a new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listLoaded, listKey]);

  const header = (
    <DiscoverHeader filters={filters} onChangeFilters={setFilters} personaId={personaId} />
  );

  let placeholder = <ProductGridSkeleton />;
  if (products.isError && !products.isFetchingNextPage && items.length === 0) {
    placeholder = <ErrorState error={products.error} onRetry={() => void products.refetch()} />;
  } else if (!products.isPending && personasReady && items.length === 0) {
    placeholder = (
      <EmptyState
        title={tr.discoverEmptyTitle}
        body={hasActiveFilters(filters) ? tr.discoverEmptyBody : undefined}
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
        onPressItem={(id) => router.push(productHref(id, 'discover'))}
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

/** Date and bell, the greeting, then the search field (whose camera is Keşfet's way into "Görselden bul"). */
function DiscoverTop() {
  const me = useMe();
  const now = new Date();

  return (
    // The date shares its row with the bell; the greeting gets the full width below, and may wrap, so the user's
    // name is never cut.
    <View style={styles.greeting}>
      <View style={styles.greetingRow}>
        <Text style={styles.date} numberOfLines={1}>
          {formatLongDay(now)}
        </Text>
        <NotificationBell />
      </View>
      <Text style={styles.hello}>{buildGreeting(now, me.data?.displayName)}</Text>
    </View>
  );
}

function DiscoverHeader({ filters, onChangeFilters, personaId }: DiscoverHeaderProps) {
  return (
    <View style={styles.header}>
      <DiscoverTop />
      <SearchEntry />

      <StyleSwitcher />
      <DailyCard />

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
    gap: theme.spacing.md,
  },
  greeting: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.lg,
  },
  date: {
    ...theme.typography.body,
    color: theme.colors.muted,
    flex: 1,
  },
  hello: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  sectionTitle: {
    ...theme.typography.subhead,
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
    color: theme.colors.muted,
    textAlign: 'center',
  },
});
