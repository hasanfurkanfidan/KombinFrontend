import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type { UserProfile } from '@/api/models';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { IMAGE_LIST_TUNING } from '@/components/listTuning';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useMe } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { useCreator, useFollowToggle, useUserPosts, useUserProfile } from './hooks';
import { postKey, renderPost } from './PostCard';
import { usePostViewTracking, type PostViewSource } from './postViews';
import { SocialHeader } from './SocialHeader';

/** A profile link is the creator's own page (an Instagram, a blog): only web links are opened, and never a seller. */
/**
 * The host a creator's link points at, when it may be opened: `https` only, no credentials. The card shows this host,
 * not the raw link, so a long address cannot hide where it really goes (`https://instagram.com.evil.example/…`).
 */
export function creatorLinkHost(link: string): string | null {
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) {
      return null;
    }
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

/** A person's profile: who they are, the counters, follow, and their posts the caller may see. */
export function UserProfileScreen({ id }: { id: string }) {
  const profile = useUserProfile(id);
  const posts = useUserPosts(id);
  const notFound = profile.error instanceof ApiError && profile.error.status === 404;

  return (
    <Screen padded={false}>
      <SocialHeader title={tr.userTitle} fallback="/" />
      {profile.isError ? (
        <ErrorState
          title={notFound ? tr.userNotFound : tr.userLoadFailed}
          error={profile.error}
          onRetry={notFound ? undefined : () => void profile.refetch()}
        />
      ) : (
        <ProfilePosts
          header={profile.data ? <ProfileCard profile={profile.data} /> : <ProfileSkeleton />}
          posts={posts}
          source="profile"
          emptyTitle={tr.userNoPosts}
        />
      )}
    </Screen>
  );
}

/** A creator's page by handle: bio, link, the commission disclosure and posts. Reports `creator_profile_view` once. */
export function CreatorScreen({ handle }: { handle: string }) {
  const creator = useCreator(handle);
  const profileId = creator.data?.profile.id;
  // The creator page already carries the first page of posts; later pages come from the user's post list.
  const posts = useUserPosts(profileId, creator.data?.posts);
  const reported = useRef<string | null>(null);
  const notFound = creator.error instanceof ApiError && creator.error.status === 404;

  useEffect(() => {
    if (profileId && reported.current !== profileId) {
      reported.current = profileId;
      track('creator_profile_view', { creatorId: profileId });
    }
  }, [profileId]);

  return (
    <Screen padded={false}>
      <SocialHeader title={tr.creatorTitle} fallback="/" />
      {creator.isError ? (
        <ErrorState
          title={notFound ? tr.creatorNotFound : tr.creatorLoadFailed}
          error={creator.error}
          onRetry={notFound ? undefined : () => void creator.refetch()}
        />
      ) : (
        <ProfilePosts
          header={
            creator.data ? (
              <ProfileCard profile={creator.data.profile} disclosure={creator.data.disclosure} />
            ) : (
              <ProfileSkeleton />
            )
          }
          posts={posts}
          source="creator"
          emptyTitle={tr.creatorNoPosts}
        />
      )}
    </Screen>
  );
}

interface ProfilePostsProps {
  header: ReactElement;
  posts: ReturnType<typeof useUserPosts>;
  source: PostViewSource;
  emptyTitle: string;
}

function ProfilePosts({ header, posts, source, emptyTitle }: ProfilePostsProps) {
  const items = useMemo(() => posts.data?.pages.flatMap((page) => page.items) ?? [], [posts.data]);
  const viewTracking = usePostViewTracking(source);

  return (
    <FlatList
      {...IMAGE_LIST_TUNING}
      data={items}
      keyExtractor={postKey}
      renderItem={renderPost}
      ListHeaderComponent={header}
      ListEmptyComponent={
        posts.isError ? (
          <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
        ) : posts.isPending ? undefined : (
          <EmptyState title={emptyTitle} />
        )
      }
      onEndReached={() => {
        if (posts.hasNextPage && !posts.isFetchingNextPage) {
          void posts.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.6}
      onViewableItemsChanged={viewTracking.onViewableItemsChanged}
      viewabilityConfig={viewTracking.viewabilityConfig}
      showsVerticalScrollIndicator={false}
      testID="profile-posts"
    />
  );
}

function ProfileCard({ profile, disclosure }: { profile: UserProfile; disclosure?: string }) {
  const me = useMe();
  const isMe = me.data?.id === profile.id;
  const follow = useFollowToggle(profile.id, profile.isFollowing);
  const linkHost = profile.link ? creatorLinkHost(profile.link) : null;

  return (
    <View style={styles.card} testID="profile-card">
      <View style={styles.identity}>
        <Avatar name={profile.displayName} size="lg" testID="profile-card-avatar" />
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.displayName}
          </Text>
          {profile.handle ? <Text style={styles.handle}>{`@${profile.handle}`}</Text> : null}
          {profile.followsYou ? <Text style={styles.handle}>{tr.userFollowsYou}</Text> : null}
        </View>
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {profile.link && linkHost ? (
        <Pressable
          accessibilityRole="link"
          accessibilityHint={profile.link}
          onPress={() =>
            void WebBrowser.openBrowserAsync(profile.link ?? '').catch(() => undefined)
          }
          testID="profile-link"
        >
          <Text style={styles.link} numberOfLines={1}>
            {linkHost}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.counters}>
        <Text style={styles.counter}>{tr.creatorFollowers(toNumber(profile.followerCount))}</Text>
        <Text style={styles.counter}>
          {tr.userFollowingCount(toNumber(profile.followingCount))}
        </Text>
        <Text style={styles.counter}>{tr.creatorPostCount(toNumber(profile.postCount))}</Text>
      </View>

      {!isMe ? (
        <Button
          label={follow.following ? tr.postFollowing : tr.postFollow}
          variant={follow.following ? 'secondary' : 'primary'}
          onPress={follow.toggle}
          loading={follow.pending}
          testID="profile-follow"
        />
      ) : null}
      {disclosure ? <Text style={styles.disclosure}>{disclosure}</Text> : null}
    </View>
  );
}

function ProfileSkeleton() {
  return (
    <View style={styles.card} testID="profile-skeleton">
      <Skeleton height={theme.sizes.avatar} width="60%" radius={theme.radius.control} />
      <Skeleton height={16} width="80%" radius={theme.radius.tag} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xl,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  handle: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  bio: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  link: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
  counters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
  },
  counter: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink2,
  },
  disclosure: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});
