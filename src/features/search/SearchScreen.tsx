import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import type { ProductColor } from '@/api/models';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { ALL, colorOptions, sortOptionsFor } from '@/features/catalog/FilterBar';
import { colorLabels, defaultSort, sortLabels, withPersona } from '@/features/catalog/filters';
import type { SortValue } from '@/features/catalog/filters';
import { useProducts } from '@/features/catalog/hooks';
import { OptionSheet } from '@/features/catalog/OptionSheet';
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductGrid';
import { productHref } from '@/features/catalog/productLink';
import { useActivePersona, usePersonas } from '@/features/personas/hooks';
import { usePrefsStore } from '@/session/prefsStore';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { MIN_SEARCH_LENGTH, useBrandSuggestions, useSearchTerm } from './hooks';
import { priceLabel } from './priceFilter';
import { PriceSheet } from './PriceSheet';
import { SearchInput } from './SearchField';

interface Refinements {
  sort?: SortValue;
  color?: ProductColor;
  minPrice?: number;
  maxPrice?: number;
}

/** A brand chip belongs to the term it was picked for; a new term leaves it behind. */
interface PickedBrand {
  slug: string;
  term: string;
}

type Picker = 'sort' | 'price' | 'color';

/**
 * Search (`/search`, opened from Keşfet's field). Nothing typed: recent searches or a one-line hint. From two
 * characters, 300 ms after the last keystroke: up to four brand chips and the product grid, with Sırala / Fiyat / Renk
 * under the field. The screen has no filled action of its own.
 */
export function SearchScreen() {
  const router = useRouter();
  const { text, term, setText, commit, active } = useSearchTerm();
  const recents = usePrefsStore((state) => state.recentSearches);
  const addRecent = usePrefsStore((state) => state.addRecentSearch);
  const clearRecents = usePrefsStore((state) => state.clearRecentSearches);

  const [refinements, setRefinements] = useState<Refinements>({});
  const [picked, setPicked] = useState<PickedBrand | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const brandSlug = picked?.term === term ? picked.slug : undefined;

  // Like Keşfet: signed in, wait for the personas so the results come back scored for the active style.
  const { isSignedIn } = useSession();
  const personas = usePersonas();
  const personaId = useActivePersona()?.id;
  const personasReady = !isSignedIn || !personas.isPending;

  const filters = withPersona({ ...refinements, query: term, brandSlug }, personaId);
  const products = useProducts(filters, active && personasReady);
  const brands = useBrandSuggestions(term, active);
  const items = useMemo(
    () => products.data?.pages.flatMap((page) => page.items) ?? [],
    [products.data],
  );

  // One `search` per term, once its first page has settled. The length only: the text never leaves the phone.
  const reported = useRef<string | null>(null);
  const settled = active && personasReady && products.status !== 'pending';
  useEffect(() => {
    if (settled && reported.current !== term) {
      reported.current = term;
      track('search', { queryLength: term.length });
    }
  }, [settled, term]);

  const submit = (value: string) => {
    commit(value);
    if (value.trim().length >= MIN_SEARCH_LENGTH) {
      addRecent(value);
    }
  };

  // A recent or a popular term: searched at once, like a keyboard submit.
  const pickRecent = (recent: string) => {
    Keyboard.dismiss();
    submit(recent);
  };

  const refined =
    brandSlug !== undefined || Object.values(refinements).some((value) => value !== undefined);
  const clearRefinements = () => {
    setRefinements({});
    setPicked(null);
  };
  const close = () => setPicker(null);
  const fallbackSort = defaultSort(personaId);

  const brandRow =
    active && brands.data && brands.data.length > 0 ? (
      <View style={styles.brands}>
        <Text style={styles.sectionLabel}>{tr.searchBrands}</Text>
        <View style={styles.brandChips}>
          {brands.data.map((brand) => (
            <Chip
              key={brand.id}
              label={brand.name}
              selected={brandSlug === brand.slug}
              onPress={() =>
                setPicked(brandSlug === brand.slug ? null : { slug: brand.slug, term })
              }
              testID={`search-brand-${brand.slug}`}
            />
          ))}
        </View>
      </View>
    ) : (
      <View />
    );

  let placeholder = <ProductGridSkeleton />;
  if (products.isError && items.length === 0) {
    placeholder = <ErrorState error={products.error} onRetry={() => void products.refetch()} />;
  } else if (products.isSuccess && items.length === 0) {
    placeholder = (
      <EmptyState
        title={tr.searchEmpty(term)}
        action={{ label: tr.searchWithPhoto, onPress: () => router.push('/lens?entry=other') }}
      />
    );
  }

  const footer =
    products.isFetchNextPageError && items.length > 0 ? (
      <View style={styles.loadMoreFailed}>
        <Text style={styles.muted}>{tr.discoverLoadMoreFailed}</Text>
        <Button
          label={tr.retry}
          variant="secondary"
          onPress={() => void products.fetchNextPage()}
        />
      </View>
    ) : null;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <IconButton icon="arrowLeft" label={tr.searchBack} onPress={() => router.back()} />
        <SearchInput
          value={text}
          onChangeText={setText}
          onSubmit={() => submit(text)}
          onClear={() => commit('')}
        />
      </View>

      {active ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            <Chip
              label={refinements.sort ? sortLabels[refinements.sort] : tr.filterSort}
              selected={Boolean(refinements.sort)}
              dropdown
              onPress={() => setPicker('sort')}
              testID="search-filter-sort"
            />
            <Chip
              label={priceLabel(refinements)}
              selected={refinements.minPrice !== undefined || refinements.maxPrice !== undefined}
              dropdown
              onPress={() => setPicker('price')}
              testID="search-filter-price"
            />
            <Chip
              label={refinements.color ? colorLabels[refinements.color] : tr.filterColor}
              selected={Boolean(refinements.color)}
              dropdown
              onPress={() => setPicker('color')}
              testID="search-filter-color"
            />
            {refined ? (
              <Chip
                label={tr.searchFiltersClear}
                onPress={clearRefinements}
                testID="search-filters-clear"
              />
            ) : null}
          </ScrollView>
          <ProductGrid
            items={items}
            onPressItem={(id) => router.push(productHref(id, 'search'))}
            header={brandRow}
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
        </>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.idle}
          testID="search-idle"
        >
          {recents.length > 0 ? (
            <>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionLabel}>{tr.searchRecentTitle}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={clearRecents}
                  hitSlop={theme.spacing.md}
                  testID="search-recent-clear"
                >
                  <Text style={styles.link}>{tr.searchRecentClear}</Text>
                </Pressable>
              </View>
              {recents.map((recent) => (
                <Pressable
                  key={recent}
                  accessibilityRole="button"
                  onPress={() => pickRecent(recent)}
                  style={styles.recentRow}
                  testID={`search-recent-${recent}`}
                >
                  <Icon name="search" size={18} color={theme.colors.muted} />
                  <Text style={styles.recentText} numberOfLines={1}>
                    {recent}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : (
            <Text style={styles.hint}>{tr.searchHint}</Text>
          )}
          {/* Recents come first; the static popular terms always follow. */}
          <View style={styles.popular} testID="search-popular">
            <Text style={styles.sectionLabel}>{tr.searchPopularTitle}</Text>
            <View style={styles.popularChips}>
              {tr.searchPopular.map((popular) => (
                <Chip
                  key={popular}
                  label={popular}
                  onPress={() => pickRecent(popular)}
                  testID={`search-popular-${popular}`}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <OptionSheet
        visible={picker === 'sort'}
        title={tr.filterSort}
        options={sortOptionsFor(personaId)}
        selected={refinements.sort ?? fallbackSort}
        onSelect={(value) => {
          setRefinements({ ...refinements, sort: value === fallbackSort ? undefined : value });
          close();
        }}
        onClose={close}
      />
      <OptionSheet
        visible={picker === 'color'}
        title={tr.filterColor}
        options={colorOptions}
        selected={refinements.color ?? ALL}
        onSelect={(value) => {
          setRefinements({ ...refinements, color: value === ALL ? undefined : value });
          close();
        }}
        onClose={close}
      />
      <PriceSheet
        visible={picker === 'price'}
        value={refinements}
        onApply={(range) => {
          setRefinements({ ...refinements, ...range });
          close();
        }}
        onClose={close}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.xs,
    // The standard gap between a chip row and what it filters: the grid, or its brand row, starts below it.
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  brands: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.lg,
  },
  brandChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    ...theme.typography.captionStrong,
    color: theme.colors.muted,
  },
  idle: {
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  recentRow: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  recentText: {
    ...theme.typography.body,
    color: theme.colors.ink,
    flex: 1,
  },
  popular: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xl,
  },
  popularChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  link: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
  hint: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  loadMoreFailed: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
});
