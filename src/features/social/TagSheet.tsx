import { Image, StyleSheet, Text, View } from 'react-native';

import type { Post, PostTag } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { openOffer } from '@/features/catalog/buy';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { formatTry } from '@/utils/money';

import { tagOffer } from './labels';

interface TagSheetProps {
  post: Pick<Post, 'id'>;
  /** One tag (a dot was tapped) or all of them (the band was tapped); `null` closes the sheet. */
  tags: readonly PostTag[] | null;
  onClose: () => void;
}

/**
 * What a tagged piece is, what it costs and where, and a buy button. Buying only ever goes through the offer's
 * `goPath` (which already says `src=feed&post=…`): the app never sees a seller URL.
 */
export function TagSheet({ tags, onClose }: TagSheetProps) {
  return (
    <BottomSheet visible={tags !== null} onClose={onClose}>
      {(tags ?? []).map((tag) => (
        <TagRow key={tag.id} tag={tag} />
      ))}
    </BottomSheet>
  );
}

function TagRow({ tag }: { tag: PostTag }) {
  const offer = tagOffer(tag);
  return (
    <View style={styles.row} testID={`tag-row-${tag.id}`}>
      <View style={[styles.thumb, { backgroundColor: colorTint(tag.color ?? 'Other') }]}>
        {tag.imageUrl ? (
          <Image source={{ uri: tag.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <Icon name="shirt" size={22} color={theme.colors.borderStrong} strokeWidth={1.4} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {tag.name}
        </Text>
        {tag.inWardrobe ? (
          <Text style={styles.owned}>
            {tag.inWardrobe === 'exact' ? tr.postInWardrobeExact : tr.postInWardrobeSimilar}
          </Text>
        ) : null}
        {tag.offer ? (
          <Text style={styles.meta}>
            {formatTry(tag.offer.price)}
            {tag.offer.seller ? ` · ${tr.postTagSeller(tag.offer.seller.name)}` : ''}
          </Text>
        ) : (
          <Text style={styles.meta}>{tr.postTagNoOffer}</Text>
        )}
      </View>
      {offer ? (
        <Button
          label={tr.postTagBuy}
          onPress={() => void openOffer(offer, { source: 'feed' })}
          trailingIcon="arrowUpRight"
          style={styles.buy}
          testID={`tag-buy-${tag.id}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  thumb: {
    width: theme.sizes.tagThumb,
    height: theme.sizes.tagThumb,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.xs,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  owned: {
    ...theme.typography.captionMedium,
    color: theme.colors.inkSoft,
  },
  meta: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  buy: {
    height: theme.sizes.touch,
    paddingHorizontal: theme.spacing.lg,
  },
});
