import { StyleSheet, Text, View } from 'react-native';

import type { BulkPiece } from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ToggleRow } from '@/components/ToggleRow';
import { CategoryChips, ColorSwatches } from '@/features/wardrobe/ItemFields';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';

import { pieceName } from './BulkPieceTile';
import type { PieceDraft } from './flow';

interface PieceSheetProps {
  piece: BulkPiece | null;
  draft: PieceDraft | null;
  onChange: (id: string, patch: Partial<PieceDraft>) => void;
  onClose: () => void;
}

/**
 * The larger cut-out of one piece (the review image, private), every reason the server gave, the duplicate hint, the
 * single add's category chips and colour swatches, and the tick as a switch. Edits apply at once; "Tamam" closes.
 */
export function PieceSheet({ piece, draft, onChange, onClose }: PieceSheetProps) {
  const open = piece !== null && draft !== null;
  return (
    <BottomSheet
      visible={open}
      title={open ? pieceName(piece, draft) : tr.bulkPieceFallback}
      onClose={onClose}
    >
      {open ? (
        <SheetBody piece={piece} draft={draft} onChange={onChange} onClose={onClose} />
      ) : null}
    </BottomSheet>
  );
}

function SheetBody({
  piece,
  draft,
  onChange,
  onClose,
}: {
  piece: BulkPiece;
  draft: PieceDraft;
  onChange: PieceSheetProps['onChange'];
  onClose: () => void;
}) {
  const suggested = [
    ...new Set([
      ...piece.categoryCandidates.map((candidate) => candidate.slug),
      ...(piece.category ? [piece.category.slug] : []),
    ]),
  ];
  const knownNames = Object.fromEntries(
    [...piece.categoryCandidates, ...(piece.category ? [piece.category] : [])].map((ref) => [
      ref.slug,
      ref.name,
    ]),
  );
  const duplicate = piece.likelyDuplicate;
  return (
    <>
      <View style={[styles.cutout, { backgroundColor: colorTint(draft.color) }]}>
        <AppImage uri={piece.imageUrl} style={styles.image} contentFit="contain" private />
      </View>
      {piece.reasons.map((reason) => (
        <Text key={reason.code} style={styles.reason}>
          {reason.message}
        </Text>
      ))}
      {duplicate ? (
        <View style={styles.duplicate}>
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
      <ToggleRow
        title={tr.bulkTickRow}
        value={draft.ticked}
        onChange={(ticked) => onChange(piece.id, { ticked })}
        testID="bulk-sheet-tick"
      />
      <CategoryChips
        label={
          piece.needsCategory && draft.categorySlug === null
            ? tr.wardrobeCategoryAsk
            : tr.wardrobeCategoryLabel
        }
        suggested={suggested}
        knownNames={knownNames}
        value={draft.categorySlug}
        onChange={(categorySlug) => onChange(piece.id, { categorySlug })}
      />
      <ColorSwatches value={draft.color} onChange={(color) => onChange(piece.id, { color })} />
      <Button label={tr.bulkSheetDone} onPress={onClose} testID="bulk-sheet-done" />
    </>
  );
}

const styles = StyleSheet.create({
  cutout: {
    height: theme.sizes.itemCutoutHeight,
    borderRadius: theme.radius.tile,
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  reason: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  duplicate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  duplicateThumb: {
    width: theme.sizes.pickerThumb,
    height: theme.sizes.pickerThumb,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  duplicateText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary,
    flexShrink: 1,
  },
});
