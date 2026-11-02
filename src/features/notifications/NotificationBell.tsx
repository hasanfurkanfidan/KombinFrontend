import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { IconButton } from '@/components/IconButton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { useUnreadCount } from './hooks';

/** The bell on Keşfet: opens the notifications screen and shows how many are unread. */
export function NotificationBell() {
  const router = useRouter();
  const unread = useUnreadCount();

  return (
    <View>
      <IconButton
        icon="bell"
        label={tr.notifBellLabel(unread)}
        tone="tinted"
        onPress={() => router.push('/notifications')}
        testID="notification-bell"
      />
      {unread > 0 ? (
        <View style={styles.badge} pointerEvents="none" testID="notification-badge">
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    minWidth: theme.sizes.badge,
    height: theme.sizes.badge,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...theme.typography.overline,
    letterSpacing: 0,
    color: theme.colors.onInk,
  },
});
