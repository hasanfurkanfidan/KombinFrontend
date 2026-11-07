import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post, PostTag } from '@/api/models';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { stableImageUrl } from './imageUrl';
import { dotCenter, isOutfitPost, pct, postBand } from './labels';

/** A photo post is shown at its own aspect ratio; a collage is square. */
const COLLAGE_ASPECT = 1;
const FALLBACK_ASPECT = 4 / 5;

interface TagDotProps {
  tag: PostTag;
  index: number;
  onPress: (tag: PostTag) => void;
}

/** One tag: a white ring with an ink core at the centre of its box. A solid ring means the viewer owns it. */
function TagDot({ tag, index, onPress }: TagDotProps) {
  const { left, top } = dotCenter(tag);
  const half = theme.sizes.tagDot / 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.postTagDot(tag.name)}
      hitSlop={(theme.sizes.touch - theme.sizes.tagDot) / 2}
      onPress={() => onPress(tag)}
      testID={`tag-dot-${index}`}
      style={[
        styles.dot,
        {
          left: pct(left),
          top: pct(top),
          marginLeft: -half,
          marginTop: -half,
        },
        tag.inWardrobe === 'similar' && styles.dotSimilar,
      ]}
    >
      <View style={styles.dotCore} />
    </Pressable>
  );
}

interface PostPhotoProps {
  post: Post;
  onTagPress: (tag: PostTag) => void;
  /** The band at the bottom ("Bu kombin toplam …") opens the list of every tagged piece. */
  onBandPress: () => void;
}

/**
 * The photo of a post with a dot per confirmed tag and the price band. An outfit post has no photo: its pieces are
 * drawn as a collage from each tag's own image at the tag's box.
 */
export function PostPhoto({ post, onTagPress, onBandPress }: PostPhotoProps) {
  const collage = isOutfitPost(post);
  const aspect = collage
    ? COLLAGE_ASPECT
    : post.image?.aspect
      ? toNumber(post.image.aspect)
      : FALLBACK_ASPECT;

  return (
    <View style={[styles.frame, { aspectRatio: aspect }]} testID={`post-photo-${post.id}`}>
      {collage ? (
        <View style={styles.collage} testID="post-collage">
          {post.tags.map((tag) => (
            <View
              key={tag.id}
              testID={`collage-tile-${tag.id}`}
              style={[
                styles.tile,
                {
                  left: pct(toNumber(tag.x)),
                  top: pct(toNumber(tag.y)),
                  width: pct(toNumber(tag.w)),
                  height: pct(toNumber(tag.h)),
                },
              ]}
            >
              {tag.imageUrl ? (
                <Image source={{ uri: tag.imageUrl }} style={styles.fill} resizeMode="contain" />
              ) : (
                <Icon name="shirt" size={28} color={theme.colors.borderStrong} strokeWidth={1.4} />
              )}
            </View>
          ))}
        </View>
      ) : post.image ? (
        <Image
          source={{ uri: stableImageUrl(post.id, post.image.url) }}
          style={styles.fill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {post.tags.map((tag, index) => (
        <TagDot key={tag.id} tag={tag} index={index} onPress={onTagPress} />
      ))}

      {post.tags.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBandPress}
          style={styles.band}
          testID="post-band"
        >
          <Text style={styles.bandText} numberOfLines={2}>
            {postBand(post.summary)}
          </Text>
          <Icon name="arrowRight" size={18} color={theme.colors.onInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  collage: {
    ...StyleSheet.absoluteFill,
  },
  tile: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.surface,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    width: theme.sizes.tagDot,
    height: theme.sizes.tagDot,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.ink,
  },
  dotSimilar: {
    borderStyle: 'dashed',
  },
  dotCore: {
    width: theme.sizes.tagDotCore,
    height: theme.sizes.tagDotCore,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  band: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.ink,
  },
  bandText: {
    flex: 1,
    ...theme.typography.bodyMedium,
    color: theme.colors.onInk,
  },
});
