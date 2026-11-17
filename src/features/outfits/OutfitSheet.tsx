import { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Outfit } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { useOutfitActions, type OutfitActions } from './actions';
import { gapPieces } from './labels';
import { lines } from '@/utils/a11y';
import { TryOnAction } from '@/features/tryon/TryOnAction';
import { outfitPieceNames } from '@/features/tryon/labels';

/** Pulling the sheet down this far counts as dismissing the outfit. */
const SWIPE_DOWN_PX = 80;

/** Pan handlers for a grabber: a downward swipe calls `onSwipeDown`. Not covered by tests (needs a device). */
function useSwipeDown(onSwipeDown: (() => void) | undefined) {
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          onSwipeDown !== undefined &&
          gesture.dy > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > SWIPE_DOWN_PX) {
            onSwipeDown?.();
          }
        },
      }).panHandlers,
    [onSwipeDown],
  );
}

interface OutfitSheetProps {
  outfit: Outfit;
  actions: OutfitActions;
  /** Swiping the sheet down dismisses the outfit (the daily screen asks why); omitted where there is nothing to dismiss. */
  onSwipeDown?: () => void;
}

/**
 * The white panel under the grid. `Complete`: save and "wore it today". `NeedsOne` / `CatalogOnly`: what is missing,
 * what it costs, where it is cheapest, and the way to buy it. Prices come from the backend; nothing is computed here.
 */
export function OutfitSheet({ outfit, actions, onSwipeDown }: OutfitSheetProps) {
  const handlers = useSwipeDown(onSwipeDown);
  const gaps = gapPieces(outfit.pieces);
  const shopping = outfit.kind === 'Shopping';
  const needsOne = outfit.completeness === 'NeedsOne' && gaps.length === 1;
  const cost = shopping ? outfit.totalPrice : outfit.completionPrice;

  const saveButton = (
    <Button
      label={actions.saved ? tr.outfitSaved : tr.outfitSave}
      variant="secondary"
      onPress={actions.save}
      loading={actions.saving}
      disabled={actions.saved}
      style={styles.half}
      testID="outfit-save"
    />
  );

  // The header line: what the outfit needs, and, only when the backend can draw it, the quiet "Manken üstünde gör".
  const header = (caption: string) => (
    <View style={styles.header}>
      <Text style={[styles.caption, styles.headerCaption]}>{caption}</Text>
      <TryOnAction
        subject={{ kind: 'outfit', id: outfit.id }}
        names={outfitPieceNames(outfit.pieces)}
        variant="text"
      />
    </View>
  );

  return (
    <View style={styles.sheet} testID="outfit-sheet">
      <View {...handlers} style={styles.grabArea}>
        <View style={styles.grabber} />
      </View>

      {gaps.length === 0 ? (
        <>
          {header(tr.outfitReady)}
          <View style={styles.buttons}>
            {saveButton}
            {actions.canWear ? (
              <Button
                label={actions.worn ? tr.outfitWornToday : tr.outfitWearToday}
                onPress={actions.wear}
                loading={actions.wearing}
                disabled={actions.worn}
                style={styles.half}
                testID="outfit-wear"
              />
            ) : null}
          </View>
        </>
      ) : (
        <>
          {header(
            shopping
              ? tr.outfitFromStore
              : gaps.length === 1
                ? tr.outfitCompleteOne
                : tr.outfitCompleteMany(gaps.length),
          )}
          {cost !== null ? (
            <Text style={styles.price} testID="outfit-price">
              {formatTry(toNumber(cost))}
            </Text>
          ) : null}
          <View style={styles.rows}>
            {gaps.map((piece) => (
              <Pressable
                key={`${piece.slot}-${piece.name}`}
                accessibilityRole="button"
                disabled={!piece.offer}
                onPress={() => actions.buy(piece)}
                style={styles.row}
                testID={`outfit-gap-${piece.slot}`}
              >
                <Text style={styles.rowText} numberOfLines={lines(1)}>
                  {piece.offer?.seller
                    ? tr.outfitPieceLine(piece.offer.seller.name, piece.name)
                    : piece.name}
                </Text>
                {piece.offer ? (
                  <Text style={styles.rowPrice}>{formatTry(toNumber(piece.offer.price))}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
          <View style={styles.buttons}>
            {saveButton}
            {needsOne ? (
              <Button
                label={tr.outfitBuy}
                trailingIcon="arrowRight"
                onPress={() => gaps[0] && actions.buy(gaps[0])}
                style={styles.half}
                testID="outfit-buy"
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

/** `OutfitSheet` wired to the outfit's save / wear / buy actions. */
export function OutfitPanel({ outfit, onSwipeDown }: Omit<OutfitSheetProps, 'actions'>) {
  const actions = useOutfitActions(outfit);
  return <OutfitSheet outfit={outfit} actions={actions} onSwipeDown={onSwipeDown} />;
}

const REASONS = [
  { value: 'DontLikeColors', label: tr.outfitDismissColors },
  { value: 'TooFormal', label: tr.outfitDismissFormal },
  { value: 'TooCasual', label: tr.outfitDismissCasual },
  { value: 'WrongWeather', label: tr.outfitDismissWeather },
] as const;

export type DismissReason = (typeof REASONS)[number]['value'];

/** The one-tap "why not?" after dismissing a suggestion. "Sadece kapat" leaves without telling us. */
export function DismissSheet({
  visible,
  onReason,
  onJustClose,
  onCancel,
}: {
  visible: boolean;
  onReason: (reason: DismissReason) => void;
  onJustClose: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet visible={visible} title={tr.outfitDismissTitle} onClose={onCancel}>
      {REASONS.map((reason) => (
        <Pressable
          key={reason.value}
          accessibilityRole="button"
          onPress={() => onReason(reason.value)}
          style={styles.reason}
          testID={`dismiss-${reason.value}`}
        >
          <Text style={styles.reasonText}>{reason.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={onJustClose}
        style={styles.reason}
        testID="dismiss-close"
      >
        <Text style={[styles.reasonText, styles.reasonMuted]}>{tr.outfitDismissJustClose}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.panel,
    borderTopRightRadius: theme.radius.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: theme.colors.line,
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  grabArea: {
    minHeight: theme.sizes.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: theme.sizes.grabberWidth,
    height: theme.sizes.grabberHeight,
    borderRadius: theme.sizes.grabberHeight / 2,
    backgroundColor: theme.colors.control,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  headerCaption: {
    flex: 1,
  },
  caption: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  price: {
    ...theme.typography.priceLarge,
    color: theme.colors.ink,
  },
  rows: {
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
  },
  row: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  rowText: {
    ...theme.typography.body,
    color: theme.colors.ink2,
    flexShrink: 1,
  },
  rowPrice: {
    ...theme.typography.price,
    color: theme.colors.ink,
  },
  buttons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  half: {
    flex: 1,
  },
  reason: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  reasonText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  reasonMuted: {
    color: theme.colors.muted,
  },
});
