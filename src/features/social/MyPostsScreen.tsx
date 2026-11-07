import { useMemo, type ReactElement } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Post } from '@/api/models';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { useDeletePost, useMyPosts } from './hooks';
import { stableImageUrl } from './imageUrl';
import { statusLabel, statusMessage, visibilityLabel } from './labels';
import { usePostViewTracking } from './postViews';
import { SocialHeader } from './SocialHeader';

/** A post that has not been published yet can still be picked back up. */
const RESUMABLE = new Set<Post['status']>(['Draft', 'Processing']);

/** "Gönderilerim": every post of the author's with its status and the backend's message, and delete. */
export function MyPostsScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const mine = useMyPosts();
  const remove = useDeletePost();
  const posts = useMemo(() => mine.data?.pages.flatMap((page) => page.items) ?? [], [mine.data]);

  const viewTracking = usePostViewTracking('mine');

  const confirmDelete = (post: Post) =>
    Alert.alert(tr.myPostsDeleteTitle, tr.myPostsDeleteBody, [
      { text: tr.cancel, style: 'cancel' },
      { text: tr.postDelete, style: 'destructive', onPress: () => remove.mutate(post.id) },
    ]);

  let placeholder: ReactElement | null = null;
  if (!isSignedIn) {
    placeholder = (
      <EmptyState
        title={tr.postNewSignIn}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    );
  } else if (mine.isPending) {
    placeholder = (
      <View style={styles.skeleton} testID="myposts-skeleton">
        <Skeleton height={theme.sizes.postThumbHeight} radius={theme.radius.xl} />
        <Skeleton height={theme.sizes.postThumbHeight} radius={theme.radius.xl} />
      </View>
    );
  } else if (mine.isError && posts.length === 0) {
    placeholder = <ErrorState title={tr.myPostsLoadFailed} onRetry={() => void mine.refetch()} />;
  } else if (posts.length === 0) {
    placeholder = (
      <EmptyState
        title={tr.myPostsEmptyTitle}
        body={tr.myPostsEmptyBody}
        action={{ label: tr.myPostsShare, onPress: () => router.push('/posts/new') }}
      />
    );
  }

  return (
    <Screen padded={false}>
      <SocialHeader title={tr.myPostsTitle} fallback="/profile" />
      <FlatList
        data={placeholder ? [] : posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={placeholder ?? undefined}
        renderItem={({ item }) => (
          <MyPostRow
            post={item}
            onOpen={() =>
              RESUMABLE.has(item.status)
                ? router.push({ pathname: '/posts/new', params: { postId: item.id } })
                : router.push(`/posts/${item.id}`)
            }
            onDelete={() => confirmDelete(item)}
          />
        )}
        onEndReached={() => {
          if (mine.hasNextPage && !mine.isFetchingNextPage) {
            void mine.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        refreshing={mine.isRefetching && !mine.isFetchingNextPage}
        onRefresh={() => void mine.refetch()}
        onViewableItemsChanged={viewTracking.onViewableItemsChanged}
        viewabilityConfig={viewTracking.viewabilityConfig}
        showsVerticalScrollIndicator={false}
        testID="myposts-list"
      />
    </Screen>
  );
}

function MyPostRow({
  post,
  onOpen,
  onDelete,
}: {
  post: Post;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const message = statusMessage(post);
  const thumb = post.image?.previewUrl ?? post.image?.url ?? post.tags[0]?.imageUrl ?? null;
  const live = post.status === 'Live';

  return (
    <View style={styles.row} testID={`my-post-${post.id}`}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.main}>
        <View style={styles.thumb}>
          {thumb ? (
            <Image
              source={{ uri: post.image ? stableImageUrl(`${post.id}:preview`, thumb) : thumb }}
              style={styles.thumbImage}
              resizeMode="cover"
            />
          ) : (
            <Icon name="shirt" size={24} color={theme.colors.borderStrong} strokeWidth={1.4} />
          )}
        </View>
        <View style={styles.text}>
          <View style={styles.statusRow}>
            <View style={[styles.status, live && styles.statusLive]}>
              <Text
                style={[styles.statusText, live && styles.statusTextLive]}
                testID="my-post-status"
              >
                {statusLabel(post.status)}
              </Text>
            </View>
            <Text style={styles.meta}>{visibilityLabel(post.visibility)}</Text>
          </View>
          {message ? (
            <Text style={styles.message} numberOfLines={3} testID="my-post-message">
              {message}
            </Text>
          ) : post.caption ? (
            <Text style={styles.message} numberOfLines={2}>
              {post.caption}
            </Text>
          ) : null}
          {live ? (
            <Text style={styles.meta}>{tr.myPostsLikes(toNumber(post.likeCount))}</Text>
          ) : RESUMABLE.has(post.status) ? (
            <Text style={styles.resume}>{tr.myPostsContinue}</Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.postDelete}
        onPress={onDelete}
        style={styles.delete}
        testID={`my-post-delete-${post.id}`}
      >
        <Icon name="trash" size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.md,
    flexGrow: 1,
  },
  skeleton: {
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceAlt,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  thumb: {
    width: theme.sizes.postThumbWidth,
    height: theme.sizes.postThumbHeight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
  },
  text: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  status: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusLive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  statusText: {
    ...theme.typography.captionMedium,
    color: theme.colors.inkSoft,
  },
  statusTextLive: {
    color: theme.colors.onInk,
  },
  meta: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
  resume: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  delete: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
