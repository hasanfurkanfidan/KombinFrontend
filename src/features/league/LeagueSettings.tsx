import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type { LeagueTodayEntry } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { lines } from '@/utils/a11y';
import { rateLimitedText } from '@/utils/rateLimit';

import { useLeaveLeague, useWithdrawEntry } from './hooks';

interface LeagueSettingsProps {
  visible: boolean;
  onClose: () => void;
  /** Today's outfit: it can be taken out of the day only while it is still in it. */
  entry: LeagueTodayEntry | null;
}

/** Only an outfit that is competing, or waiting for its image check, can still be taken out of the day. */
export function canWithdraw(entry: LeagueTodayEntry | null): boolean {
  return entry?.status === 'Competing' || entry?.status === 'Pending';
}

/**
 * The league's two settings: "Bugünkü kombinimi yarıştan çıkar" (final for the day) and "Ligden ayrıl". Each asks first, and
 * says what it means. The result switch lives with the other notification switches (`PreferencesSheet`).
 */
export function LeagueSettings({ visible, onClose, entry }: LeagueSettingsProps) {
  const router = useRouter();
  const withdraw = useWithdrawEntry();
  const leave = useLeaveLeague();

  const confirmWithdraw = () => {
    onClose();
    Alert.alert(tr.leagueWithdrawTitle, tr.leagueWithdrawBody, [
      { text: tr.leagueCancel, style: 'cancel' },
      {
        text: tr.leagueWithdrawConfirm,
        style: 'destructive',
        onPress: () =>
          withdraw.mutate(undefined, {
            onSuccess: () => showToast(tr.leagueWithdrawn),
            onError: (error) => {
              const code = error instanceof ApiError ? error.errorCode : null;
              showToast(
                code === 'League.NoEntryToday'
                  ? tr.leagueWithdrawNoEntry
                  : code === 'League.DayClosed'
                    ? tr.leagueWithdrawClosed
                    : (rateLimitedText(error) ?? tr.leagueActionFailed),
              );
            },
          }),
      },
    ]);
  };

  const confirmLeave = () => {
    onClose();
    Alert.alert(tr.leagueLeaveTitle, tr.leagueLeaveBody, [
      { text: tr.leagueCancel, style: 'cancel' },
      {
        text: tr.leagueLeaveConfirm,
        style: 'destructive',
        onPress: () =>
          leave.mutate(undefined, {
            onSuccess: () => {
              track('league_leave', {});
              showToast(tr.leagueLeaveDone);
              // The league screen has nothing to show for someone who is not in it.
              router.replace('/');
            },
            onError: (error) => {
              // "Not joined" is what leaving wanted: the state is already right.
              if (error instanceof ApiError && error.errorCode === 'League.NotJoined') {
                router.replace('/');
              } else {
                showToast(rateLimitedText(error) ?? tr.leagueActionFailed);
              }
            },
          }),
      },
    ]);
  };

  return (
    <BottomSheet visible={visible} title={tr.leagueSettings} onClose={onClose}>
      {canWithdraw(entry) ? (
        <SettingsRow
          title={tr.leagueWithdraw}
          caption={tr.leagueWithdrawCaption}
          onPress={confirmWithdraw}
          testID="league-withdraw"
        />
      ) : null}
      <SettingsRow
        title={tr.leagueLeave}
        caption={tr.leagueLeaveCaption}
        onPress={confirmLeave}
        testID="league-leave"
      />
    </BottomSheet>
  );
}

function SettingsRow({
  title,
  caption,
  onPress,
  testID,
}: {
  title: string;
  caption: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
      onPress={onPress}
      style={styles.row}
      testID={testID}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={lines(2)}>
          {title}
        </Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
      <Icon name="chevronRight" size={18} color={theme.colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});
