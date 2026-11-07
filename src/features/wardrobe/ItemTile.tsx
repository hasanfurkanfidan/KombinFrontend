import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { WardrobeItemSummary } from '@/api/models';
import { Icon } from '@/components/Icon';
import { Shimmer } from '@/components/Shimmer';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { toNumber } from '@/utils/money';

import { useAddStore } from './addStore';

/**
 * The muted line under a tile: how many pieces it goes with. Not shown while the item is processing or failed, nor for
 * a card the backend has not counted yet (`companionCount` is only on the list endpoint).
 */
export function companionCaption(item: WardrobeItemSummary): string | null {
  if (
    item.status !== 'Ready' ||
    item.companionCount === undefined ||
    item.companionCount === null
  ) {
    return null;
  }
  const count = toNumber(item.companionCount);
  return count > 0 ? tr.wardrobeCompanions(count) : tr.wardrobeNoCompanions;
}

interface ItemTileProps {
  item: WardrobeItemSummary;
  width: number;
  onPress: (id: string) => void;
  onRetry: (id: string) => void;
}

export function ItemTile({ item, width, onPress, onRetry }: ItemTileProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const localUri = useAddStore((state) => state.localUris[item.id]);
  const failureReason = useAddStore((state) => state.failureReasons[item.id]);
  const processing = item.status === 'Processing';
  const failed = item.status === 'Failed';
  // The server's thumbnail is a cutout on transparent ground (contain); the local photo fills the tile while we wait.
  const uri = item.thumbUrl ?? localUri;
  const isCutout = item.thumbUrl !== null;
  const caption = companionCaption(item);

  return (
    <View style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name ?? tr.wardrobeItemUnnamed}
        disabled={processing}
        onPress={() => (failed ? onRetry(item.id) : onPress(item.id))}
        style={[
          styles.tile,
          { width, height: width, backgroundColor: colorTint(item.primaryColor) },
        ]}
        testID={`wardrobe-item-${item.id}`}
      >
        {uri && !imageFailed ? (
          <Image
            source={{ uri }}
            style={[styles.image, isCutout && styles.cutout]}
            resizeMode={isCutout ? 'contain' : 'cover'}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon name="shirt" size={40} color={theme.colors.borderStrong} strokeWidth={1.4} />
        )}

        {processing ? (
          <>
            <Shimmer />
            <View style={[styles.pill, styles.pillLight]} testID={`wardrobe-processing-${item.id}`}>
              <Text style={styles.pillTextDark}>{tr.wardrobeProcessing}</Text>
            </View>
          </>
        ) : failed ? (
          <>
            <View style={styles.failedBadge} testID={`wardrobe-failed-${item.id}`}>
              <Text style={styles.failedMark}>!</Text>
            </View>
            <View style={[styles.pill, styles.pillWarning]}>
              <Text style={styles.pillTextLight}>{tr.wardrobeFailedRetry}</Text>
            </View>
          </>
        ) : null}
      </Pressable>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1} testID={`wardrobe-companions-${item.id}`}>
          {caption}
        </Text>
      ) : null}
      {failed && failureReason ? (
        <Text style={styles.reason} numberOfLines={2} testID={`wardrobe-failure-reason-${item.id}`}>
          {failureReason}
        </Text>
      ) : null}
    </View>
  );
}

/** The dashed "+" cell that closes the grid. */
export function AddTile({ width, onPress }: { width: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.wardrobeAddButton}
      onPress={onPress}
      style={[styles.tile, styles.addTile, { width, height: width }]}
      testID="wardrobe-add-tile"
    >
      <Icon name="plus" size={28} color={theme.colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: theme.spacing.xs,
  },
  reason: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: theme.spacing.xs,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  cutout: {
    margin: theme.spacing.md,
  },
  addTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
  },
  pill: {
    position: 'absolute',
    left: theme.spacing.sm,
    bottom: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  pillLight: {
    backgroundColor: theme.colors.surface,
  },
  pillWarning: {
    backgroundColor: theme.colors.warning,
  },
  pillTextDark: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink,
  },
  pillTextLight: {
    ...theme.typography.captionMedium,
    color: theme.colors.onInk,
  },
  failedBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: theme.sizes.statusBadge,
    height: theme.sizes.statusBadge,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedMark: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
  },
});
