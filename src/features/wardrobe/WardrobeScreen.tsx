import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { DailyCard } from '@/features/outfits/DailyCard';
import { tr } from '@/i18n/tr';
import { toNumber } from '@/utils/money';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import type { WardrobeItemSummary } from '@/api/models';

import { AddItemSheet } from './AddItemSheet';
import { retryItem } from './addItem';
import { useAddStore } from './addStore';
import { ConfirmItemSheet } from './ConfirmItemSheet';
import {
  useUnmatchedItems,
  useWardrobeGaps,
  useWardrobeItems,
  useWardrobeStats,
  type ItemFilters,
} from './hooks';
import { AddTile, ItemTile } from './ItemTile';
import { AddButton, FilterChips, GapCard, StatsRow } from './WardrobeHeader';

const COLUMNS = 3;
/** From this many pieces the daily outfit card sits on top of Dolap (fewer make thin outfits). */
export const DAILY_CARD_MIN_ITEMS = 5;
const GAP = theme.spacing.md;

type Cell = { kind: 'item'; item: WardrobeItemSummary } | { kind: 'add' };

export function WardrobeScreen() {
  const { isSignedIn } = useSession();
  return (
    <Screen padded={false}>{isSignedIn ? <SignedInWardrobe /> : <SignedOutWardrobe />}</Screen>
  );
}

function SignedOutWardrobe() {
  const router = useRouter();
  return (
    <View style={styles.signedOut}>
      <Text style={styles.title}>{tr.wardrobeTitle}</Text>
      <EmptyState
        title={tr.wardrobeSignedOutTitle}
        body={tr.wardrobeSignedOutBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    </View>
  );
}

function SignedInWardrobe() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const tileWidth = (width - theme.screenPaddingX * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const [filters, setFilters] = useState<ItemFilters>({});
  const [addOpen, setAddOpen] = useState(false);
  // The third stat card: the grid shows only the pieces that pair with nothing.
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);

  const stats = useWardrobeStats();
  const itemCount = stats.data ? toNumber(stats.data.itemCount) : 0;
  const gaps = useWardrobeGaps();
  const items = useWardrobeItems(filters);
  const unmatched = useUnmatchedItems();
  const uploading = useAddStore((state) => state.uploading);
  const confirmId = useAddStore((state) => state.confirmQueue[0] ?? null);

  // A ready item opens its confirm sheet by itself only while this tab is the one on screen.
  useFocusEffect(
    useCallback(() => {
      useAddStore.getState().setOnWardrobeScreen(true);
      return () => useAddStore.getState().setOnWardrobeScreen(false);
    }, []),
  );

  const pagedList = useMemo(
    () => items.data?.pages.flatMap((page) => page.items) ?? [],
    [items.data],
  );
  const unmatchedList = unmatched.data;
  const list = useMemo(
    () => (unmatchedOnly ? (unmatchedList ?? []) : pagedList),
    [unmatchedOnly, unmatchedList, pagedList],
  );
  const filtered = unmatchedOnly || Boolean(filters.category ?? filters.color);
  const cells: Cell[] = useMemo(
    () => [...list.map((item): Cell => ({ kind: 'item', item })), { kind: 'add' }],
    [list],
  );
  const changeFilters = (next: ItemFilters) => {
    setUnmatchedOnly(false);
    setFilters(next);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{tr.wardrobeTitle}</Text>
        <AddButton onPress={() => setAddOpen(true)} />
      </View>
      {itemCount >= DAILY_CARD_MIN_ITEMS ? <DailyCard flush /> : null}
      <StatsRow
        stats={stats.data}
        unmatched={unmatched.data?.length}
        unmatchedActive={unmatchedOnly}
        onToggleUnmatched={() => setUnmatchedOnly((on) => !on)}
      />
      <GapCard gaps={gaps.data} />
      <FilterChips filters={filters} onChange={changeFilters} suspended={unmatchedOnly} />
      {uploading && uploading.total > 1 ? (
        <View style={styles.progress} testID="upload-progress">
          <Text style={styles.progressText}>
            {tr.wardrobeUploading(uploading.current, uploading.total)}
          </Text>
        </View>
      ) : null}
    </View>
  );

  let placeholder: ReactElement | null = null;
  const source = unmatchedOnly ? unmatched : items;
  if (source.isPending) {
    placeholder = <GridSkeleton tileWidth={tileWidth} />;
  } else if (source.isError && list.length === 0) {
    placeholder = <ErrorState body={tr.wardrobeLoadFailed} onRetry={() => void source.refetch()} />;
  }

  const emptyWardrobe = !source.isPending && !source.isError && list.length === 0 && !filtered;
  const emptyFilter = !source.isPending && !source.isError && list.length === 0 && filtered;

  return (
    <>
      <FlatList
        data={placeholder || emptyWardrobe || emptyFilter ? [] : cells}
        keyExtractor={(cell) => (cell.kind === 'item' ? cell.item.id : 'add')}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={
          placeholder ??
          (emptyWardrobe ? (
            <EmptyState
              title={tr.wardrobeEmptyTitle}
              body={tr.wardrobeEmptyBody}
              action={{ label: tr.wardrobeAddButton, onPress: () => setAddOpen(true) }}
            />
          ) : (
            <EmptyState
              title={unmatchedOnly ? tr.wardrobeUnmatchedEmpty : tr.wardrobeFilteredEmpty}
              action={{ label: tr.wardrobeShowAll, onPress: () => changeFilters({}) }}
            />
          ))
        }
        renderItem={({ item: cell }) =>
          cell.kind === 'add' ? (
            <AddTile width={tileWidth} onPress={() => setAddOpen(true)} />
          ) : (
            <ItemTile
              item={cell.item}
              width={tileWidth}
              onPress={(id) => router.push(`/wardrobe/${id}`)}
              onRetry={(id) => void retryItem(queryClient, id)}
            />
          )
        }
        ListFooterComponent={
          items.isFetchNextPageError ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{tr.wardrobeLoadMoreFailed}</Text>
              <Button
                label={tr.retry}
                variant="secondary"
                onPress={() => void items.fetchNextPage()}
              />
            </View>
          ) : (
            <View style={styles.footer} />
          )
        }
        onEndReached={() => {
          if (
            !unmatchedOnly &&
            items.hasNextPage &&
            !items.isFetchingNextPage &&
            !items.isFetchNextPageError
          ) {
            void items.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        refreshing={items.isRefetching && !items.isFetchingNextPage}
        onRefresh={() => {
          void items.refetch();
          void stats.refetch();
          void unmatched.refetch();
          void gaps.refetch();
        }}
        showsVerticalScrollIndicator={false}
      />
      <AddItemSheet visible={addOpen} onClose={() => setAddOpen(false)} />
      <ConfirmItemSheet
        itemId={confirmId}
        mode="confirm"
        onClose={() => confirmId && useAddStore.getState().dequeueConfirm(confirmId)}
        onDone={() => confirmId && useAddStore.getState().dequeueConfirm(confirmId)}
      />
    </>
  );
}

function GridSkeleton({ tileWidth }: { tileWidth: number }) {
  return (
    <View testID="wardrobe-skeleton">
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          {[0, 1, 2].map((column) => (
            <Skeleton key={column} width={tileWidth} height={tileWidth} radius={theme.radius.xl} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  signedOut: {
    flex: 1,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.lg,
  },
  content: {
    paddingHorizontal: theme.screenPaddingX,
  },
  header: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  progress: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  progressText: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  footer: {
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.md,
  },
  footerText: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
});
