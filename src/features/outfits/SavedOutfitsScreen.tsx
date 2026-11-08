import { useMemo, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import type { Outfit } from '@/api/models';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { useSavedOutfits } from './hooks';
import { outfitTitle } from './labels';
import { OutfitCollage } from './OutfitCollage';

const COLUMNS = 2;

export function SavedOutfitsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isSignedIn } = useSession();
  const saved = useSavedOutfits();
  const cardWidth = (width - theme.screenPaddingX * 2 - theme.gridGap) / COLUMNS;
  const outfits = useMemo(
    () => saved.data?.pages.flatMap((page) => page.items) ?? [],
    [saved.data],
  );

  let placeholder: ReactElement | null = null;
  if (!isSignedIn) {
    placeholder = (
      <EmptyState
        title={tr.outfitSignedOutTitle}
        body={tr.outfitSignedOutBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    );
  } else if (saved.isPending) {
    placeholder = (
      <View style={styles.row} testID="saved-skeleton">
        <Skeleton width={cardWidth} height={cardWidth} radius={theme.radius.xl} />
        <Skeleton width={cardWidth} height={cardWidth} radius={theme.radius.xl} />
      </View>
    );
  } else if (saved.isError && outfits.length === 0) {
    placeholder = (
      <ErrorState title={tr.outfitSavedLoadFailed} onRetry={() => void saved.refetch()} />
    );
  } else if (outfits.length === 0) {
    placeholder = (
      <EmptyState
        title={tr.outfitSavedEmptyTitle}
        body={tr.outfitSavedEmptyBody}
        action={{ label: tr.outfitSavedEmptyAction, onPress: () => router.push('/outfits/daily') }}
      />
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <IconButton
          icon="arrowLeft"
          label={tr.back}
          tone="tinted"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          testID="saved-back"
        />
        <Text style={styles.title}>{tr.outfitSavedTitle}</Text>
      </View>
      <FlatList
        data={placeholder ? [] : outfits}
        keyExtractor={(outfit) => outfit.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        ListEmptyComponent={placeholder ?? undefined}
        renderItem={({ item }) => (
          <SavedCard
            outfit={item}
            width={cardWidth}
            onPress={() => router.push(`/outfits/${item.id}`)}
          />
        )}
        ListFooterComponent={
          saved.isFetchNextPageError ? (
            <Button
              label={tr.retry}
              variant="secondary"
              onPress={() => void saved.fetchNextPage()}
            />
          ) : (
            <View style={styles.footer} />
          )
        }
        onEndReached={() => {
          if (saved.hasNextPage && !saved.isFetchingNextPage && !saved.isFetchNextPageError) {
            void saved.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        refreshing={saved.isRefetching && !saved.isFetchingNextPage}
        onRefresh={() => void saved.refetch()}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function SavedCard({
  outfit,
  width,
  onPress,
}: {
  outfit: Outfit;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ width, gap: theme.spacing.sm }}
      testID={`saved-outfit-${outfit.id}`}
    >
      <OutfitCollage pieces={outfit.pieces} />
      <Text style={styles.cardTitle} numberOfLines={1}>
        {outfitTitle(outfit, outfit.date)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingVertical: theme.spacing.md,
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
  content: {
    paddingHorizontal: theme.screenPaddingX,
  },
  row: {
    gap: theme.gridGap,
    marginBottom: theme.gridGap,
  },
  cardTitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  footer: {
    paddingBottom: theme.spacing.xxxl,
  },
});
