import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { track } from '@/analytics';
import type { FeedMode } from '@/api/endpoints/social';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { useActivePersona, usePersonas } from '@/features/personas/hooks';
import { PersonaChips } from '@/features/personas/PersonaChips';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { TomorrowCard } from '@/features/outfits/TomorrowCard';
import { useMe } from '@/features/profile/hooks';
import { FeedSection } from '@/features/social/FeedSection';
import { SegmentedControl } from '@/features/tracking/SegmentedControl';
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

type DiscoverSection = 'products' | 'feed';

const SECTION_OPTIONS = [
  { value: 'products', label: tr.discoverSectionProducts },
  { value: 'feed', label: tr.discoverSectionFeed },
] as const satisfies readonly { value: DiscoverSection; label: string }[];

/**
 * Keşfet has two sections under one header: "Ürünler" (the product grid, the default) and "Akış" (the posts feed).
 * Like the filters, the section and the feed mode live in the URL params, so the back stack restores them.
 */
export function DiscoverScreen() {
  const router = useRouter();
  const { view, mode } = useLocalSearchParams<{ view?: string; mode?: string }>();
  const section: DiscoverSection = view === 'feed' ? 'feed' : 'products';
  const setSection = (next: DiscoverSection) =>
    router.setParams({ view: next === 'feed' ? 'feed' : '' });

  if (section === 'feed') {
    const feedMode: FeedMode = mode === 'following' ? 'following' : 'forYou';
    return (
      <Screen padded={false}>
        <FeedSection
          header={<DiscoverTop section={section} onSection={setSection} />}
          mode={feedMode}
          onModeChange={(next) =>
            router.setParams({ mode: next === 'following' ? 'following' : '' })
          }
        />
      </Screen>
    );
  }
  return <ProductsSection onSection={setSection} />;
}

function ProductsSection({ onSection }: { onSection: (next: DiscoverSection) => void }) {
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
    <DiscoverHeader
      filters={filters}
      onChangeFilters={setFilters}
      personaId={personaId}
      onSection={onSection}
    />
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
  onSection: (next: DiscoverSection) => void;
}

/** Greeting, the bell and the "Ürünler / Akış" switch: the top of both sections. */
function DiscoverTop({
  section,
  onSection,
}: {
  section: DiscoverSection;
  onSection: (next: DiscoverSection) => void;
}) {
  const me = useMe();
  const now = new Date();

  return (
    <View style={styles.top}>
      <View style={styles.greetingRow}>
        <View style={styles.greeting}>
          <Text style={styles.date}>{formatLongDay(now)}</Text>
          <Text style={styles.hello} numberOfLines={1}>
            {buildGreeting(now, me.data?.displayName)}
          </Text>
        </View>
        <NotificationBell />
      </View>
      <View style={styles.sections}>
        <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={onSection} />
      </View>
    </View>
  );
}

function DiscoverHeader({ filters, onChangeFilters, personaId, onSection }: DiscoverHeaderProps) {
  return (
    <View style={styles.header}>
      <DiscoverTop section="products" onSection={onSection} />

      <PersonaChips />
      <TomorrowCard />

      <Text style={styles.sectionTitle}>{tr.discoverForYou}</Text>
      <View style={styles.filters}>
        <FilterBar filters={filters} onChange={onChangeFilters} personaId={personaId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  sections: {
    paddingHorizontal: theme.screenPaddingX,
  },
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
