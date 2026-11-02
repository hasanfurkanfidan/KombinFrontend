import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import type { NotificationPreferences } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { Stepper } from '@/components/Stepper';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import {
  getPushPermission,
  openNotificationSettings,
  requestPushPermission,
  type PushPermission,
} from '@/push';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { useNotificationPreferences, useUpdateNotificationPreferences } from './hooks';
import { TimeStepper } from './TimeStepper';

const MIN_WEEKLY = 1;
const MAX_WEEKLY = 7;
const DEFAULT_QUIET_START = '22:00';
const DEFAULT_QUIET_END = '08:00';

interface Draft {
  priceAlerts: boolean;
  stockAlerts: boolean;
  recommendations: boolean;
  weeklyMax: number;
  quiet: boolean;
  quietStart: string;
  quietEnd: string;
}

/** The backend answers `HH:mm`; tolerate seconds all the same. */
const hhmm = (time: string) => time.slice(0, 5);

export function toDraft(prefs: NotificationPreferences): Draft {
  const quiet = prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null;
  return {
    priceAlerts: prefs.priceAlerts,
    stockAlerts: prefs.stockAlerts,
    recommendations: prefs.recommendations,
    weeklyMax: Math.min(
      MAX_WEEKLY,
      Math.max(MIN_WEEKLY, toNumber(prefs.maxRecommendationsPerWeek)),
    ),
    quiet,
    quietStart: prefs.quietHoursStart ? hhmm(prefs.quietHoursStart) : DEFAULT_QUIET_START,
    quietEnd: prefs.quietHoursEnd ? hhmm(prefs.quietHoursEnd) : DEFAULT_QUIET_END,
  };
}

/** The `PUT /me/notification-preferences` body for a draft: quiet hours are both set or cleared. */
export function toRequest(draft: Draft) {
  return {
    priceAlerts: draft.priceAlerts,
    stockAlerts: draft.stockAlerts,
    recommendations: draft.recommendations,
    maxRecommendationsPerWeek: draft.weeklyMax,
    ...(draft.quiet
      ? { quietHoursStart: draft.quietStart, quietHoursEnd: draft.quietEnd, clearQuietHours: false }
      : { clearQuietHours: true }),
  };
}

interface PreferencesSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** What to be notified about, how often and when not: `GET/PUT /me/notification-preferences`. */
export function PreferencesSheet({ visible, onClose }: PreferencesSheetProps) {
  const prefs = useNotificationPreferences(visible);

  return (
    <BottomSheet visible={visible} title={tr.profileNotifications} onClose={onClose}>
      {prefs.isError ? (
        <ErrorState onRetry={() => void prefs.refetch()} />
      ) : prefs.data ? (
        <PreferencesForm initial={prefs.data} onSaved={onClose} />
      ) : (
        <View style={styles.skeletons}>
          <Skeleton height={48} radius={theme.radius.lg} />
          <Skeleton height={48} radius={theme.radius.lg} />
          <Skeleton height={48} radius={theme.radius.lg} />
        </View>
      )}
    </BottomSheet>
  );
}

function PreferencesForm({
  initial,
  onSaved,
}: {
  initial: NotificationPreferences;
  onSaved: () => void;
}) {
  const update = useUpdateNotificationPreferences();
  const [draft, setDraft] = useState(() => toDraft(initial));
  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = () =>
    update.mutate(toRequest(draft), {
      onSuccess: () => {
        showToast(tr.prefsSaved);
        onSaved();
      },
      onError: () => showToast(tr.prefsSaveFailed),
    });

  return (
    <>
      <PermissionNotice />
      <ToggleRow
        title={tr.prefsPrice}
        caption={tr.prefsPriceCaption}
        value={draft.priceAlerts}
        onChange={(priceAlerts) => change({ priceAlerts })}
        testID="prefs-price"
      />
      <ToggleRow
        title={tr.prefsStock}
        caption={tr.prefsStockCaption}
        value={draft.stockAlerts}
        onChange={(stockAlerts) => change({ stockAlerts })}
        testID="prefs-stock"
      />
      <ToggleRow
        title={tr.prefsRecommendations}
        caption={tr.prefsRecommendationsCaption}
        value={draft.recommendations}
        onChange={(recommendations) => change({ recommendations })}
        testID="prefs-recommendations"
      />

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{tr.prefsWeeklyMax}</Text>
          <Text style={styles.rowCaption}>{tr.prefsWeeklyMaxValue(draft.weeklyMax)}</Text>
        </View>
        <Stepper
          value={draft.weeklyMax}
          min={MIN_WEEKLY}
          max={MAX_WEEKLY}
          label={tr.prefsWeeklyMax}
          onChange={(weeklyMax) => change({ weeklyMax })}
          testID="prefs-weekly"
        />
      </View>

      <ToggleRow
        title={tr.prefsQuietHours}
        caption={tr.prefsQuietHoursCaption}
        value={draft.quiet}
        onChange={(quiet) => change({ quiet })}
        testID="prefs-quiet"
      />
      {draft.quiet ? (
        <View style={styles.quietPickers}>
          <TimeStepper
            label={tr.prefsQuietStart}
            value={draft.quietStart}
            onChange={(quietStart) => change({ quietStart })}
            testID="prefs-quiet-start"
          />
          <TimeStepper
            label={tr.prefsQuietEnd}
            value={draft.quietEnd}
            onChange={(quietEnd) => change({ quietEnd })}
            testID="prefs-quiet-end"
          />
        </View>
      ) : null}

      <Button label={tr.prefsSave} onPress={save} loading={update.isPending} testID="prefs-save" />
    </>
  );
}

/** Shown when the OS permission is missing: pushes cannot arrive no matter what is switched on here. */
function PermissionNotice() {
  const [permission, setPermission] = useState<PushPermission>('unavailable');

  useEffect(() => {
    let active = true;
    void getPushPermission().then((value) => {
      if (active) {
        setPermission(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (permission !== 'denied' && permission !== 'undetermined') {
    return null;
  }
  return (
    <View style={styles.notice} testID="prefs-permission">
      <Text style={styles.noticeText}>
        {permission === 'denied' ? tr.prefsPermissionDenied : tr.prefsPermissionUndetermined}
      </Text>
      <Button
        label={permission === 'denied' ? tr.prefsOpenSettings : tr.prefsAllow}
        variant="secondary"
        onPress={() => {
          if (permission === 'denied') {
            void openNotificationSettings();
          } else {
            void requestPushPermission().then(setPermission);
          }
        }}
        testID="prefs-permission-action"
      />
    </View>
  );
}

interface ToggleRowProps {
  title: string;
  caption: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}

function ToggleRow({ title, caption, value, onChange, testID }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCaption}>{caption}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.surfaceAlt2, true: theme.colors.ink }}
        thumbColor={theme.colors.surface}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletons: {
    gap: theme.spacing.md,
  },
  row: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  rowCaption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  quietPickers: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    flexWrap: 'wrap',
  },
  notice: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
  },
  noticeText: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
});
