import { useMemo, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { FeedMode } from '@/api/endpoints/social';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { useActivePersona, usePersonas } from '@/features/personas/hooks';
import { SegmentedControl } from '@/features/tracking/SegmentedControl';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';

import { useFeed } from './hooks';
import { PostCard } from './PostCard';
import { usePostViewTracking } from './postViews';

const MODE_OPTIONS = [
  { value: 'forYou', label: tr.feedModeForYou },
  { value: 'following', label: tr.feedModeFollowing },
] as const satisfies readonly { value: FeedMode; label: string }[];

interface FeedSectionProps {
  /** The Keşfet header (greeting, bell, "Ürünler / Akış"); this section adds its own controls under it. */
  header: ReactElement;
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

/**
 * "Akış": the posts list of Keşfet. Its own "Keşfet / Takip" toggle sits above the list; signed-out users only get the
 * public feed, and "Takip" asks them to sign in instead of calling the endpoint.
 */
export function FeedSection({ header, mode, onModeChange }: FeedSectionProps) {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const personas = usePersonas();
  const personaId = useActivePersona()?.id;
  const personasReady = !isSignedIn || !personas.isPending;
  const needsSignIn = mode === 'following' && !isSignedIn;
  const feed = useFeed(mode, personaId, personasReady);

  const posts = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);

  const viewTracking = usePostViewTracking('feed');

  let placeholder: ReactElement | null = null;
  if (needsSignIn) {
    placeholder = (
      <EmptyState
        title={tr.feedFollowingSignInTitle}
        body={tr.feedFollowingSignInBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    );
  } else if (feed.isPending || !personasReady) {
    placeholder = (
      <View style={styles.skeleton} testID="feed-skeleton">
        <Skeleton height={theme.sizes.postAvatar} radius={theme.radius.pill} />
        <Skeleton height={theme.sizes.postSkeleton} radius={theme.radius.xl} />
        <Skeleton height={16} width="60%" radius={theme.radius.sm} />
      </View>
    );
  } else if (feed.isError && posts.length === 0) {
    placeholder = <ErrorState title={tr.feedLoadFailed} onRetry={() => void feed.refetch()} />;
  } else if (posts.length === 0) {
    placeholder =
      mode === 'following' ? (
        <EmptyState title={tr.feedFollowingEmptyTitle} body={tr.feedFollowingEmptyBody} />
      ) : (
        <EmptyState
          title={tr.feedEmptyTitle}
          body={tr.feedEmptyBody}
          action={{ label: tr.feedShare, onPress: () => router.push('/posts/new') }}
        />
      );
  }

  const listHeader = (
    <View>
      {header}
      <View style={styles.controls}>
        <View style={styles.mode}>
          <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={onModeChange} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/posts/new')}
          style={styles.share}
          testID="feed-share"
        >
          <Icon name="plus" size={16} color={theme.colors.onInk} />
          <Text style={styles.shareText}>{tr.feedShare}</Text>
        </Pressable>
      </View>
    </View>
  );

  const footer =
    feed.isFetchNextPageError && posts.length > 0 ? (
      <View style={styles.loadMoreFailed}>
        <Text style={styles.loadMoreFailedText}>{tr.feedLoadMoreFailed}</Text>
        <Button label={tr.retry} variant="secondary" onPress={() => void feed.fetchNextPage()} />
      </View>
    ) : feed.isFetchingNextPage ? (
      <ActivityIndicator style={styles.footer} color={theme.colors.ink} />
    ) : (
      <View style={styles.footer} />
    );

  return (
    <FlatList
      data={placeholder ? [] : posts}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={placeholder ?? undefined}
      ListFooterComponent={footer}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError) {
          void feed.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.6}
      refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      onRefresh={() => void feed.refetch()}
      onViewableItemsChanged={viewTracking.onViewableItemsChanged}
      viewabilityConfig={viewTracking.viewabilityConfig}
      showsVerticalScrollIndicator={false}
      testID="feed-list"
    />
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.lg,
  },
  mode: {
    flex: 1,
  },
  share: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  shareText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.onInk,
  },
  skeleton: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
  },
  footer: {
    height: theme.spacing.xxxl,
    marginBottom: theme.spacing.xxl,
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
