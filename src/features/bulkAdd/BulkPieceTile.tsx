import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BulkPiece } from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { Icon } from '@/components/Icon';
import { colorLabels } from '@/features/catalog/filters';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { lines } from '@/utils/a11y';

import type { PieceDraft } from './flow';

/** The name a piece goes by: the category the user picked (or the server's), else "Parça". */
export function pieceName(piece: BulkPiece, draft: PieceDraft): string {
  const slug = draft.categorySlug;
  if (slug === null) {
    return tr.bulkPieceFallback;
  }
  if (piece.category?.slug === slug) {
    return piece.category.name;
  }
  return (
    piece.categoryCandidates.find((candidate) => candidate.slug === slug)?.name ??
    slug.split('/').pop() ??
    tr.bulkPieceFallback
  );
}

interface BulkPieceTileProps {
  piece: BulkPiece;
  draft: PieceDraft;
  width: number;
  onChange: (id: string, patch: Partial<PieceDraft>) => void;
  onOpen: (id: string) => void;
}

/**
 * One piece of the review grid. The tile is a checkbox: a tap flips the tick (the spoken state follows), a long press
 * opens the larger cut-out. The "büyüt ve düzenle" button is the long press's visible twin, a sibling of the tile (an
 * accessible parent would hide it on iOS). Under the tile: the first reason's sentence while unticked, and the
 * "Dolabında benzeri var." hint with the existing piece's thumbnail.
 */
export const BulkPieceTile = memo(function BulkPieceTile({
  piece,
  draft,
  width,
  onChange,
  onOpen,
}: BulkPieceTileProps) {
  const name = pieceName(piece, draft);
  const reason = draft.ticked ? null : (piece.reasons[0]?.message ?? null);
  const duplicate = piece.likelyDuplicate;
  const spoken = [`${name}, ${colorLabels[draft.color]}`, reason, duplicate?.message]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={[styles.cell, { width }]} testID={`bulk-piece-${piece.id}`}>
      <View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={spoken}
          accessibilityState={{ checked: draft.ticked }}
          accessibilityActions={[{ name: 'longpress', label: tr.bulkDetailsAction }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'longpress') onOpen(piece.id);
          }}
          onPress={() => onChange(piece.id, { ticked: !draft.ticked })}
          onLongPress={() => onOpen(piece.id)}
          style={[
            styles.tile,
            { height: width, backgroundColor: colorTint(draft.color) },
            draft.ticked ? styles.tileTicked : styles.tileUnticked,
          ]}
          testID={`bulk-tick-${piece.id}`}
        >
          <View style={[styles.imageWrap, !draft.ticked && styles.imageUnticked]}>
            <AppImage uri={piece.thumbUrl} style={styles.image} contentFit="contain" private />
          </View>
          <View
            style={[styles.check, draft.ticked ? styles.checkOn : styles.checkOff]}
            testID={draft.ticked ? `bulk-checked-${piece.id}` : undefined}
          >
            {draft.ticked ? (
              <Icon name="check" size={16} color={theme.colors.onPrimary} strokeWidth={2.5} />
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.bulkDetails(name)}
          onPress={() => onOpen(piece.id)}
          style={styles.detail}
          testID={`bulk-open-${piece.id}`}
        >
          <View style={styles.detailFace}>
            <Icon name="sliders" size={16} color={theme.colors.ink} />
          </View>
        </Pressable>
      </View>

      <Text style={styles.name} numberOfLines={lines(1)}>
        {name}
      </Text>
      {reason ? (
        <Text style={styles.reason} testID={`bulk-reason-${piece.id}`}>
          {reason}
        </Text>
      ) : null}
      {duplicate ? (
        <View style={styles.duplicate} testID={`bulk-duplicate-${piece.id}`}>
          <View style={styles.duplicateThumb}>
            <AppImage
              uri={duplicate.thumbUrl}
              style={styles.image}
              contentFit="contain"
              accessibilityLabel={tr.bulkSimilarThumb}
            />
          </View>
          <Text style={styles.duplicateText}>{duplicate.message}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  cell: {
    gap: theme.spacing.xs,
  },
  tile: {
    borderRadius: theme.radius.tile,
    overflow: 'hidden',
  },
  tileTicked: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  tileUnticked: {
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  imageWrap: {
    flex: 1,
    padding: theme.spacing.md,
  },
  imageUnticked: {
    opacity: 0.6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  check: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: theme.sizes.bulkCheck,
    height: theme.sizes.bulkCheck,
    borderRadius: theme.radius.tag,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: theme.colors.primary,
  },
  checkOff: {
    backgroundColor: theme.colors.bg,
    borderWidth: theme.sizes.dashedBorder,
    borderColor: theme.colors.control,
  },
  detail: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: theme.sizes.touch,
    height: theme.sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailFace: {
    width: theme.sizes.bulkTileButton,
    height: theme.sizes.bulkTileButton,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink,
  },
  reason: {
    ...theme.typography.caption,
    color: theme.colors.ink2,
  },
  duplicate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  duplicateThumb: {
    width: theme.sizes.bulkSimilarThumb,
    height: theme.sizes.bulkSimilarThumb,
    borderRadius: theme.radius.tag,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  duplicateText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    flexShrink: 1,
  },
});
