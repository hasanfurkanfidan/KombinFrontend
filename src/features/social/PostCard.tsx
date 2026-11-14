import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import type { Post, PostTag } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { useMe } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { useBlockUser, useFollowToggle, useLikeToggle, usePostSave, useReportPost } from './hooks';
import { initialOf, matchText, REPORT_REASONS } from './labels';
import { PostPhoto } from './PostPhoto';
import { TagSheet } from './TagSheet';
import { TrySheet } from './TrySheet';

interface PostCardProps {
  post: Post;
}

/**
 * One post of the feed (design screen 09): author row, the photo with its tag dots and price band, like / save /
 * "Dolabımla dene", the caption and, for a creator's post, the commission disclosure.
 */
export function PostCard({ post }: PostCardProps) {
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
      <View style={styles.authorRow}>
        <Pressable
          accessibilityRole="button"
          onPress={openAuthor}
          style={styles.author}
          testID="post-author"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialOf(post.author.displayName)}</Text>
          </View>
          {/* Three short lines, none of which has to truncate at 390 px: the name; the "Kreatör" chip and the handle;
              then "Sana uygun %N" on its own. */}
          <View style={styles.authorText}>
            <Text style={styles.name} numberOfLines={2}>
              {post.author.displayName}
            </Text>
            {post.author.isCreator || post.author.handle ? (
              <View style={styles.subRow}>
                {post.author.isCreator ? (
                  <View style={styles.creatorChip} testID="creator-chip">
                    <Text style={styles.creatorChipText}>{tr.postCreatorChip}</Text>
                  </View>
                ) : null}
                {post.author.handle ? (
                  <Text style={styles.sub} numberOfLines={1} testID="post-author-sub">
                    {`@${post.author.handle}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {match ? (
              <Text style={styles.sub} testID="post-match">
                {match}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {!isMine ? (
          <Pressable
            accessibilityRole="button"
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
  avatar: {
    width: theme.sizes.postAvatar,
    height: theme.sizes.postAvatar,
    borderRadius: theme.sizes.postAvatar / 2,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  authorText: {
    flex: 1,
    gap: 2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    ...theme.typography.label,
    color: theme.colors.ink,
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
  followButton: {
    minHeight: theme.sizes.touch,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Following someone is the user's choice: the selected-chip treatment.
  followButtonActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  followText: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink,
  },
  followTextActive: {
    color: theme.colors.primary,
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
