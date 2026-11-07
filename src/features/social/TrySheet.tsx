import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Outfit, TryGroup } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { openOffer } from '@/features/catalog/buy';
import { gapPieces } from '@/features/outfits/labels';
import { OutfitCollage } from '@/features/outfits/OutfitCollage';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry } from '@/utils/money';

import { useTryPost } from './hooks';

interface TrySheetProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
}

const COLLAGE_SIZE = 96;

/**
 * "Dolabımla dene": the post's tagged products as anchors against the viewer's own wardrobe. A piece that is still
 * missing shows its price and cheapest seller, and buying goes through its `goPath` like everywhere else.
 */
export function TrySheet({ postId, visible, onClose }: TrySheetProps) {
  const attempt = useTryPost();
  const { mutate } = attempt;

  // One request per opening; the result is not kept, because the wardrobe may have changed since (a new `mutate`
  // clears the previous result while it runs).
  useEffect(() => {
    if (visible) {
      mutate(postId);
    }
  }, [visible, postId, mutate]);

  const groups = attempt.data?.groups ?? [];
  const outfitCount = groups.reduce((sum, group) => sum + group.outfits.length, 0);

  let body;
  if (attempt.isError) {
    const nothing = attempt.error instanceof ApiError && attempt.error.status === 409;
    body = (
      <View style={styles.centered} testID="try-error">
        <Text style={styles.message}>{nothing ? tr.tryNothing : tr.tryFailed}</Text>
        {nothing ? null : (
          <Button label={tr.retry} variant="secondary" onPress={() => mutate(postId)} />
        )}
      </View>
    );
  } else if (!attempt.data) {
    body = (
      <View style={styles.centered} testID="try-loading">
        <ActivityIndicator color={theme.colors.ink} />
        <Text style={styles.message}>{tr.tryLoading}</Text>
      </View>
    );
  } else if (outfitCount === 0) {
    body = <Text style={styles.message}>{tr.tryNothing}</Text>;
  } else {
    body = groups.map((group) => <Group key={group.tagId} group={group} />);
  }

  return (
    <BottomSheet visible={visible} title={tr.tryTitle} onClose={onClose}>
      <View style={styles.body} testID="try-sheet">
        {body}
      </View>
    </BottomSheet>
  );
}

function Group({ group }: { group: TryGroup }) {
  return (
    <View style={styles.group} testID={`try-group-${group.tagId}`}>
      {group.message ? <Text style={styles.groupMessage}>{group.message}</Text> : null}
      {group.owned ? <Text style={styles.owned}>{tr.tryOwned}</Text> : null}
      {group.outfits.map((outfit) => (
        <TryOutfit key={outfit.id} outfit={outfit} />
      ))}
    </View>
  );
}

function TryOutfit({ outfit }: { outfit: Outfit }) {
  const gaps = gapPieces(outfit.pieces);
  return (
    <View style={styles.outfit} testID={`try-outfit-${outfit.id}`}>
      <View style={styles.collage}>
        <OutfitCollage pieces={outfit.pieces} />
      </View>
      <View style={styles.outfitText}>
        <Text style={styles.completeness}>
          {gaps.length === 0
            ? tr.tryComplete
            : outfit.completionPrice !== null
              ? tr.tryNeedsOne(formatTry(outfit.completionPrice))
              : tr.outfitCompleteMany(gaps.length)}
        </Text>
        {gaps.map((piece) => (
          <View key={`${piece.slot}-${piece.name}`} style={styles.gapRow}>
            <View style={styles.gapText}>
              <Text style={styles.gapName} numberOfLines={1}>
                {piece.name}
              </Text>
              {piece.offer ? (
                <Text style={styles.gapMeta}>
                  {formatTry(piece.offer.price)}
                  {piece.offer.seller ? ` · ${tr.postTagSeller(piece.offer.seller.name)}` : ''}
                </Text>
              ) : null}
            </View>
            {piece.offer ? (
              <Button
                label={tr.postTagBuy}
                trailingIcon="arrowUpRight"
                onPress={() =>
                  piece.offer &&
                  void openOffer(
                    { id: piece.offer.offerId, goPath: piece.offer.goPath },
                    { source: 'feed' },
                  )
                }
                style={styles.buy}
                testID={`try-buy-${piece.offer.offerId}`}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: theme.spacing.xl,
  },
  centered: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xl,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  group: {
    gap: theme.spacing.md,
  },
  groupMessage: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  owned: {
    ...theme.typography.captionMedium,
    color: theme.colors.inkSoft,
  },
  outfit: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceAlt,
  },
  collage: {
    width: COLLAGE_SIZE,
  },
  outfitText: {
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  completeness: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  gapText: {
    flex: 1,
  },
  gapName: {
    ...theme.typography.body,
    color: theme.colors.ink,
  },
  gapMeta: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  buy: {
    height: theme.sizes.touch,
    paddingHorizontal: theme.spacing.md,
  },
});
