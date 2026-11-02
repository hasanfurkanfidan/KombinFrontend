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

  return (
    <View style={styles.sheet} testID="outfit-sheet">
      <View {...handlers} style={styles.grabArea}>
        <View style={styles.grabber} />
      </View>

      {gaps.length === 0 ? (
        <>
          <Text style={styles.caption}>{tr.outfitReady}</Text>
          <View style={styles.buttons}>
            {saveButton}
            <Button
              label={actions.worn ? tr.outfitWornToday : tr.outfitWearToday}
              onPress={actions.wear}
              loading={actions.wearing}
              disabled={actions.worn}
              style={styles.half}
              testID="outfit-wear"
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.caption}>
            {shopping
              ? tr.outfitFromStore
              : gaps.length === 1
                ? tr.outfitCompleteOne
                : tr.outfitCompleteMany(gaps.length)}
          </Text>
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
                <Text style={styles.rowText} numberOfLines={1}>
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
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
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
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
  },
  caption: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  price: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  rows: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
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
    color: theme.colors.inkSoft,
    flexShrink: 1,
  },
  rowPrice: {
    ...theme.typography.bodyStrong,
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
    color: theme.colors.inkMuted,
  },
});
