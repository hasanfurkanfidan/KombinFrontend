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
    borderRadius: theme.sizes.badge / 2,
    backgroundColor: theme.colors.chalk,
    borderWidth: 2,
    borderColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...theme.typography.tab,
    fontFamily: theme.fontFamilies.semibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.chalkInk,
  },
});
