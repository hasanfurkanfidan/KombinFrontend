import { memo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import type { Post, PostTag } from '@/api/models';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { useMe } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { useBlockUser, useFollowToggle, useLikeToggle, usePostSave, useReportPost } from './hooks';
import { matchText, REPORT_REASONS } from './labels';
import { PostPhoto } from './PostPhoto';
import { TagSheet } from './TagSheet';
import { TrySheet } from './TrySheet';
import { lines } from '@/utils/a11y';

interface PostCardProps {
  post: Post;
}

/**
 * One post of the feed (design screen 09): author row, the photo with its tag dots and price band, like / save /
 * "Dolabımla dene", the caption and, for a creator's post, the commission disclosure.
 *
 * Memoised: the feed re-renders on every page fetch and refetch, but a card only re-renders when its own post object
 * changes (the cache patches replace only the post they touch) or one of its own hooks says so.
 */
export const PostCard = memo(function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const me = useMe();
  const isMine = me.data?.id === post.author.id;

  const like = useLikeToggle(post);
  const save = usePostSave(post);
  const follow = useFollowToggle(post.author.id, post.followingAuthor);

  const [tagSheet, setTagSheet] = useState<readonly PostTag[] | null>(null);
  const [trying, setTrying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openAuthor = () =>
    router.push(
      post.author.isCreator && post.author.handle
        ? `/creators/${post.author.handle}`
        : `/users/${post.author.id}`,
    );

  const tapTag = (tag: PostTag) => {
    track('post_tag_tap', { postId: post.id, tagKind: tag.kind, hasOffer: tag.offer !== null });
    setTagSheet([tag]);
  };

  const match = matchText(post.matchScore);
  const likeCount = toNumber(post.likeCount);

  return (
    <View style={styles.card} testID={`post-${post.id}`}>
      {/* The name shares its row with follow and the menu; the "Kreatör" chip with the handle, and then
          "Sana uygun %N", sit under it across the full width, so nothing truncates at 390 px. */}
      <View style={styles.authorBlock}>
        <View style={styles.authorRow}>
          <Pressable
            accessibilityRole="button"
            onPress={openAuthor}
            style={styles.author}
            testID="post-author"
          >
            <Avatar name={post.author.displayName} testID="post-avatar" />
            <Text style={styles.name} numberOfLines={lines(2)}>
              {post.author.displayName}
            </Text>
          </Pressable>
          {!isMine ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                follow.following
                  ? tr.a11yFollowing(post.author.displayName)
                  : tr.a11yFollow(post.author.displayName)
              }
              accessibilityState={{ busy: follow.pending }}
              onPress={follow.toggle}
              style={[styles.followButton, follow.following && styles.followButtonActive]}
              testID="post-follow"
            >
              <Text style={[styles.followText, follow.following && styles.followTextActive]}>
                {follow.following ? tr.postFollowing : tr.postFollow}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.postMenu}
            onPress={() => setMenuOpen(true)}
            style={styles.menuButton}
            testID="post-menu"
          >
            <Icon name="more" size={20} />
          </Pressable>
        </View>
        {post.author.isCreator || post.author.handle || match ? (
          <Pressable onPress={openAuthor} style={styles.authorLines} accessible={false}>
            {post.author.isCreator || post.author.handle ? (
              <View style={styles.subRow}>
                {post.author.isCreator ? (
                  <View style={styles.creatorChip} testID="creator-chip">
                    <Text style={styles.creatorChipText}>{tr.postCreatorChip}</Text>
                  </View>
                ) : null}
                {post.author.handle ? (
                  <Text style={styles.sub} numberOfLines={lines(1)} testID="post-author-sub">
                    {`@${post.author.handle}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {match ? (
              <Text style={styles.match} testID="post-match">
                {match}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <PostPhoto post={post} onTagPress={tapTag} onBandPress={() => setTagSheet(post.tags)} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={like.liked ? tr.postUnlike : tr.postLike}
          accessibilityState={{ selected: like.liked }}
          onPress={like.toggle}
          style={styles.action}
          testID="post-like"
        >
          <Icon
            name="heart"
            size={22}
            filled={like.liked}
            color={like.liked ? theme.colors.primary : theme.colors.ink}
          />
          <Text style={styles.count} testID="post-like-count">
            {likeCount}
          </Text>
        </Pressable>
        {save.available ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={save.saved ? tr.postUnsave : tr.postSave}
            accessibilityState={{ selected: save.saved }}
            onPress={save.toggle}
            style={styles.action}
            testID="post-save"
          >
            <Icon
              name="bookmark"
              size={22}
              filled={save.saved}
              color={save.saved ? theme.colors.primary : theme.colors.ink}
            />
          </Pressable>
        ) : null}
        <View style={styles.spacer} />
        {post.tags.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => (isSignedIn ? setTrying(true) : router.push('/login'))}
            style={styles.tryButton}
            testID="post-try"
          >
            <Text style={styles.tryText}>{tr.postTry}</Text>
          </Pressable>
        ) : null}
      </View>

      {post.caption ? (
        <Text style={styles.caption} testID="post-caption">
          <Text style={styles.captionAuthor}>{post.author.displayName} </Text>
          {post.caption}
        </Text>
      ) : null}
      {post.disclosure ? (
        <Text style={styles.disclosure} testID="post-disclosure">
          {post.disclosure}
        </Text>
      ) : null}

      <TagSheet post={post} tags={tagSheet} onClose={() => setTagSheet(null)} />
      <TrySheet postId={post.id} visible={trying} onClose={() => setTrying(false)} />
      <PostMenu post={post} isMine={isMine} visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
});

/** `renderItem` / `keyExtractor` for post lists: module-level, so they never change between renders. */
export function renderPost({ item }: { item: Post }) {
  return <PostCard post={item} />;
}

export function postKey(post: Post): string {
  return post.id;
}

interface PostMenuProps {
  post: Post;
  isMine: boolean;
  visible: boolean;
  onClose: () => void;
}

/** ⋯: "Şikayet et" (asks the reason) and "Engelle" (asks once more); neither exists for one's own post. */
function PostMenu({ post, isMine, visible, onClose }: PostMenuProps) {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const block = useBlockUser();
  const [reporting, setReporting] = useState(false);
  const report = useReportPost(post.id, () => setReporting(false));

  const needSignIn = () => {
    onClose();
    router.push('/login');
  };

  const startReport = () => {
    if (!isSignedIn) {
      needSignIn();
      return;
    }
    onClose();
    setReporting(true);
  };

  const startBlock = () => {
    if (!isSignedIn) {
      needSignIn();
      return;
    }
    onClose();
    Alert.alert(tr.blockConfirmTitle, tr.blockConfirmBody, [
      { text: tr.cancel, style: 'cancel' },
      {
        text: tr.postBlock,
        style: 'destructive',
        onPress: () => block.mutate(post.author.id),
      },
    ]);
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        {isMine ? (
          <Text style={styles.menuHint}>{tr.postVisibilityPrivateHint}</Text>
        ) : (
          <>
            <MenuRow label={tr.postReport} onPress={startReport} testID="menu-report" />
            <MenuRow label={tr.postBlock} onPress={startBlock} testID="menu-block" />
          </>
        )}
      </BottomSheet>
      <BottomSheet visible={reporting} title={tr.reportTitle} onClose={() => setReporting(false)}>
        {REPORT_REASONS.map((reason) => (
          <MenuRow
            key={reason.value}
            label={reason.label}
            onPress={() => report.mutate(reason.value)}
            testID={`report-${reason.value}`}
          />
        ))}
      </BottomSheet>
    </>
  );
}

function MenuRow({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuRow} testID={testID}>
      <Text style={styles.menuRowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
    marginBottom: theme.spacing.xxl,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  author: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  authorBlock: {
    gap: 2,
  },
  // Under the name, from the name's left edge to the card's right edge.
  authorLines: {
    marginLeft: theme.sizes.postAvatar + theme.spacing.md,
    gap: 2,
  },
  match: {
    ...theme.typography.match,
    color: theme.colors.primary,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    ...theme.typography.label,
    color: theme.colors.ink,
    flex: 1,
  },
  creatorChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.tag,
    backgroundColor: theme.colors.surface,
  },
  creatorChipText: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  sub: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    flexShrink: 1,
  },
  // "Takip et" is the outlined green action; once following it goes quiet (muted text, no edge).
  followButton: {
    minHeight: theme.sizes.touch,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonActive: {
    borderColor: 'transparent',
    paddingHorizontal: theme.spacing.xs,
  },
  followText: {
    ...theme.typography.captionStrong,
    color: theme.colors.primary,
  },
  followTextActive: {
    color: theme.colors.muted,
  },
  menuButton: {
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  action: {
    minHeight: theme.sizes.touch,
    minWidth: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  count: {
    ...theme.typography.numeric,
    color: theme.colors.ink,
  },
  spacer: {
    flex: 1,
  },
  tryButton: {
    minHeight: theme.sizes.touch,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryText: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
  caption: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  captionAuthor: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  disclosure: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  menuHint: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  menuRow: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  menuRowText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
});
