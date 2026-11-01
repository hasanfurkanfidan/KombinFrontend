import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Alert, AlertTrigger } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useDeleteAlert, useUpdateAlert } from '@/features/alerts/hooks';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatAmount, formatTry, toNumber } from '@/utils/money';

import { alertStatus, hasRecentTrigger, isBelowTarget, type AlertStatus } from './stats';

function statusText(status: AlertStatus): { text: string; tone: 'accent' | 'warning' | 'muted' } {
  switch (status.kind) {
    case 'belowTarget':
      return { text: tr.trackStatusBelow, tone: 'accent' };
    case 'increase':
      return { text: tr.trackStatusIncrease(formatAmount(status.amount)), tone: 'warning' };
    case 'drop':
      return { text: tr.trackStatusDrop(formatAmount(status.amount)), tone: 'accent' };
    case 'backInStock':
      return { text: tr.trackStatusBackInStock, tone: 'accent' };
    case 'unchanged':
      return { text: tr.trackStatusUnchanged, tone: 'muted' };
  }
}

/** The line under the price: what the alert waits for. */
export function alertCaption(alert: Alert): string {
  if (alert.kind === 'PriceDrop' && alert.targetPrice !== null) {
    return tr.trackTarget(formatTry(alert.targetPrice));
  }
  if (alert.kind === 'BackInStock') {
    return alert.sizes.length > 0
      ? tr.trackBackInStockSizes(alert.sizes.join(', '))
      : tr.trackBackInStockAny;
  }
  return tr.trackAnyChange;
}

interface AlertRowProps {
  alert: Alert;
  triggers: readonly AlertTrigger[];
  now: Date;
  onOpen: (productId: string) => void;
}

/** One alert (design screen 10): swipe left for settings and delete, long-press for the settings sheet. */
export function AlertRow({ alert, triggers, now, onOpen }: AlertRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const update = useUpdateAlert();
  const remove = useDeleteAlert();

  const status = statusText(alertStatus(alert, triggers));
  const below = isBelowTarget(alert);
  const recent = hasRecentTrigger(alert, now);
  const price = alert.product.lowestPrice;
  const showImage = Boolean(alert.product.primaryImageUrl) && !imageFailed;

  const openSheet = () => {
    swipeable.current?.close();
    setSheetOpen(true);
  };

  const confirmDelete = () => {
    setSheetOpen(false);
    remove.mutate(alert.id, { onError: () => showToast(tr.trackUpdateFailed) });
  };

  return (
    <>
      <Swipeable
        ref={swipeable}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.trackActionsTitle}
              onPress={openSheet}
              style={[styles.action, styles.actionSettings]}
              testID={`alert-settings-${alert.id}`}
            >
              <Icon name="bell" size={20} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.trackDelete}
              onPress={confirmDelete}
              style={[styles.action, styles.actionDelete]}
              testID={`alert-delete-${alert.id}`}
            >
              <Icon name="trash" size={20} color={theme.colors.onInk} />
            </Pressable>
          </View>
        )}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(alert.product.id)}
          onLongPress={openSheet}
          style={[styles.row, recent && styles.rowRecent, !alert.isActive && styles.rowInactive]}
          testID={`alert-row-${alert.id}`}
        >
          <View style={styles.thumb}>
            {showImage ? (
              <Image
                source={{ uri: alert.product.primaryImageUrl ?? undefined }}
                style={styles.thumbImage}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Icon name="shirt" size={28} color={theme.colors.borderStrong} strokeWidth={1.4} />
            )}
          </View>
          <View style={styles.body}>
            <Text style={styles.brand} numberOfLines={1}>
              {alert.product.brandName}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {alert.product.name}
            </Text>
            <View style={styles.priceRow}>
              {price !== null ? (
                <Text style={[styles.price, below && styles.priceBelow]} numberOfLines={1}>
                  {formatTry(toNumber(price))}
                </Text>
              ) : null}
              <Text style={styles.caption} numberOfLines={1}>
                {alertCaption(alert)}
              </Text>
            </View>
            <Text style={[styles.status, styles[status.tone]]} numberOfLines={1}>
              {status.text}
            </Text>
          </View>
        </Pressable>
      </Swipeable>

      <BottomSheet
        visible={sheetOpen}
        title={alert.product.name}
        onClose={() => setSheetOpen(false)}
      >
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{tr.trackAlertActive}</Text>
          <Switch
            value={alert.isActive}
            onValueChange={(isActive) =>
              update.mutate(
                { id: alert.id, isActive },
                { onError: () => showToast(tr.trackUpdateFailed) },
              )
            }
            trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
            testID={`alert-switch-${alert.id}`}
          />
        </View>
        <Button
          label={tr.trackDelete}
          variant="secondary"
          onPress={confirmDelete}
          testID={`alert-sheet-delete-${alert.id}`}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  rowRecent: {
    borderColor: theme.colors.accent,
  },
  rowInactive: {
    opacity: 0.55,
  },
  thumb: {
    width: theme.sizes.thumbWidth,
    height: theme.sizes.thumbHeight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  brand: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  name: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  price: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  priceBelow: {
    color: theme.colors.accent,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    flexShrink: 1,
  },
  status: {
    ...theme.typography.captionMedium,
  },
  accent: {
    color: theme.colors.accent,
  },
  warning: {
    color: theme.colors.warning,
  },
  muted: {
    color: theme.colors.inkMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
  },
  action: {
    width: theme.sizes.touch + theme.spacing.md,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSettings: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  actionDelete: {
    backgroundColor: theme.colors.warning,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: theme.sizes.touch,
  },
  switchLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
});
