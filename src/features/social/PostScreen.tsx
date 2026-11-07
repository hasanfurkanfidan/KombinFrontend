import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { track } from '@/analytics';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { ApiError } from '@/api/client';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { usePost } from './hooks';
import { PostCard } from './PostCard';
import { SocialHeader } from './SocialHeader';

/** One post by id (a link, the creator's top posts, "Gönderilerim"). */
export function PostScreen({ id }: { id: string }) {
  const post = usePost(id);
  const reported = useRef<string | null>(null);

  const loadedId = post.data?.id;
  useEffect(() => {
    if (loadedId && reported.current !== loadedId) {
      reported.current = loadedId;
      track('post_view', { postId: loadedId, source: 'link' });
    }
  }, [loadedId]);

  const notFound = post.error instanceof ApiError && post.error.status === 404;

  return (
    <Screen scroll padded={false}>
      <SocialHeader title={tr.postTitle} fallback="/" />
      {post.data ? (
        <PostCard post={post.data} />
      ) : post.isError ? (
        <ErrorState
          title={notFound ? tr.postNotFound : tr.postLoadFailed}
          onRetry={notFound ? undefined : () => void post.refetch()}
        />
      ) : (
        <View style={styles.skeleton} testID="post-skeleton">
          <Skeleton height={theme.sizes.postAvatar} radius={theme.radius.pill} />
          <Skeleton height={theme.sizes.postSkeleton} radius={theme.radius.xl} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
  },
});
