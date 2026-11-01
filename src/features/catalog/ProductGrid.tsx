import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/theme';

import { ProductCard, type CardProduct } from './ProductCard';

interface ProductGridProps {
  items: readonly CardProduct[];
  onPressItem: (id: string) => void;
  /** Rendered above the grid (greeting, filters). */
  header: ReactElement;
  /** Rendered instead of the grid when there are no items: skeleton, error or empty state. */
  placeholder: ReactElement;
  /** Rendered below the last row, e.g. a "could not load more" retry. */
  footer?: ReactElement | null;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

function useCardWidth(): number {
  const { width } = useWindowDimensions();
  return (width - theme.screenPaddingX * 2 - theme.gridGap) / 2;
}

export function ProductGrid({
  items,
  onPressItem,
  header,
  placeholder,
  footer,
  isFetchingNextPage,
  onEndReached,
  refreshing,
  onRefresh,
}: ProductGridProps) {
  const cardWidth = useCardWidth();

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => (
        <ProductCard product={item} width={cardWidth} onPress={onPressItem} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={placeholder}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} color={theme.colors.ink} />
        ) : (
          (footer ?? <View style={styles.footer} />)
        )
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshing={refreshing}
      onRefresh={onRefresh}
      showsVerticalScrollIndicator={false}
    />
  );
}

/** First-load placeholder: three rows of two cards. */
export function ProductGridSkeleton() {
  const cardWidth = useCardWidth();
  return (
    <View testID="product-grid-skeleton">
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          {[0, 1].map((column) => (
            <View key={column} style={{ width: cardWidth, gap: theme.spacing.sm }}>
              <Skeleton height={theme.sizes.productImageHeight} radius={theme.radius.xl} />
              <Skeleton height={12} width="40%" radius={theme.radius.sm} />
              <Skeleton height={14} radius={theme.radius.sm} />
              <Skeleton height={14} width="60%" radius={theme.radius.sm} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: theme.screenPaddingX,
    gap: theme.gridGap,
    marginBottom: theme.spacing.xxl,
  },
  footer: {
    height: theme.spacing.xxxl,
    marginBottom: theme.spacing.xxl,
  },
});
