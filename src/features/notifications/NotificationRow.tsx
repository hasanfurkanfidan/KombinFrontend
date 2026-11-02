import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Notification, NotificationKind } from '@/api/models';
import { Icon, type IconName } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTimeAgo } from '@/utils/dates';

const KIND_ICON: Record<NotificationKind, IconName> = {
  PriceDrop: 'trendDown',
  BackInStock: 'box',
  AnyChange: 'tag',
  NewMatches: 'star',
  System: 'bell',
};

const KIND_LABEL: Record<NotificationKind, string> = {
  PriceDrop: tr.notifKindPrice,
  BackInStock: tr.notifKindStock,
  AnyChange: tr.notifKindAnyChange,
  NewMatches: tr.notifKindMatches,
  System: tr.notifKindSystem,
};

interface NotificationRowProps {
  notification: Notification;
  now: Date;
  onPress: (notification: Notification) => void;
}

/**
 * One feed entry (design screen 06). An unread one is a filled card with a dark icon square (green for a price drop,
 * the one positive signal); a read one is an outlined card with a light square.
 */
export const NotificationRow = memo(function NotificationRow({
  notification,
  now,
  onPress,
}: NotificationRowProps) {
  const unread = notification.readAt === null;
  const priceDrop = notification.kind === 'PriceDrop';
  const iconColor = unread ? theme.colors.onInk : theme.colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: unread }}
      onPress={() => onPress(notification)}
      style={[
        styles.card,
        unread ? (priceDrop ? styles.cardPrice : styles.cardUnread) : styles.cardRead,
      ]}
      testID={`notification-${notification.id}`}
    >
      <View
        style={[
          styles.iconBox,
          unread ? (priceDrop ? styles.iconPrice : styles.iconUnread) : styles.iconRead,
        ]}
      >
        <Icon name={KIND_ICON[notification.kind]} size={20} color={iconColor} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.body}>{notification.body}</Text>
        <Text style={styles.meta}>
          {`${KIND_LABEL[notification.kind]} · ${formatTimeAgo(notification.createdAt, now)}`}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
  },
  cardUnread: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  cardPrice: {
    backgroundColor: theme.colors.accentSoft,
  },
  cardRead: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconBox: {
    width: theme.sizes.notificationIcon,
    height: theme.sizes.notificationIcon,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: {
    backgroundColor: theme.colors.ink,
  },
  iconPrice: {
    backgroundColor: theme.colors.accent,
  },
  iconRead: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  text: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
  meta: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
});
