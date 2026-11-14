import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';

import { getAnonymousId } from '@/analytics';
import { ApiError } from '@/api/client';
import { cancelDeletion } from '@/api/endpoints/auth';
import type { CancelDeletionRequest } from '@/api/models';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { completeSignIn } from '@/session/useSession';
import { theme } from '@/theme';
import { formatDayMonthYear } from '@/utils/dates';
import { rateLimitedText } from '@/utils/rateLimit';

import { accountDisabledMessage } from './accountMessages';
import {
  isAccountDisabled,
  usePendingDeletionStore,
  type PendingCredentials,
} from './pendingDeletion';

function cancelBody(credentials: PendingCredentials): CancelDeletionRequest {
  return credentials.kind === 'password'
    ? { email: credentials.email, password: credentials.password }
    : { provider: credentials.provider, idToken: credentials.idToken };
}

async function failureMessage(error: unknown): Promise<string> {
  if (error instanceof ApiError) {
    if (isAccountDisabled(error)) {
      return accountDisabledMessage();
    }
    const limited = rateLimitedText(error);
    if (limited) {
      return limited;
    }
    if (error.isNetworkError) {
      return tr.errorNetwork;
    }
    if (error.errorCode === 'Identity.InvalidCredentials') {
      return tr.authInvalidCredentials;
    }
  }
  return tr.pendingFailed;
}

/**
 * The credentials were right but the account is waiting to be deleted (403 `Identity.AccountPendingDeletion`).
 * One primary action takes the deletion back and signs in with the same credentials; nothing is ever cancelled on its own.
 */
export function PendingDeletionScreen() {
  const router = useRouter();
  const scheduledFor = usePendingDeletionStore((state) => state.scheduledFor);
  const credentials = usePendingDeletionStore((state) => state.credentials);
  const clear = usePendingDeletionStore((state) => state.clear);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opened without a sign-in attempt behind it (the app was restarted): there is nothing to cancel with.
  useEffect(() => {
    if (!credentials) {
      router.replace('/login');
    }
  }, [credentials, router]);

  const leave = () => {
    clear();
    router.back();
  };

  const cancel = async () => {
    if (!credentials || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await cancelDeletion({
        ...cancelBody(credentials),
        deviceName: Device.deviceName ?? null,
        anonymousId: await getAnonymousId(),
      });
      await completeSignIn(tokens, credentials.kind);
      clear();
      router.dismissTo('/');
    } catch (failure) {
      setError(await failureMessage(failure));
      setBusy(false);
    }
  };

  const date = scheduledFor ? formatDayMonthYear(scheduledFor) : '';

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title} testID="pending-title">
          {date ? tr.pendingTitle(date) : tr.pendingTitleNoDate}
        </Text>
        <Text style={styles.body}>{tr.pendingBody}</Text>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID="pending-error">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={tr.pendingCancel}
          onPress={() => void cancel()}
          loading={busy}
          testID="pending-cancel"
        />
        <Button
          label={tr.pendingDismiss}
          variant="quiet"
          onPress={leave}
          disabled={busy}
          testID="pending-dismiss"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xxxl,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.xxl,
  },
  header: {
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  error: {
    ...theme.typography.bodyMedium,
    color: theme.colors.danger,
  },
  actions: {
    gap: theme.spacing.sm,
  },
});
