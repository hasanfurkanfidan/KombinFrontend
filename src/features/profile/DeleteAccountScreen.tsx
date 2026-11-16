import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/api/client';
import { deleteAccount } from '@/api/endpoints/auth';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/toastStore';
import { SocialHeader } from '@/features/social/SocialHeader';
import { tr } from '@/i18n/tr';
import { clearLocalSession, useHasPassword } from '@/session/useSession';
import { theme } from '@/theme';
import { formatDayMonthYear } from '@/utils/dates';
import { rateLimitedText } from '@/utils/rateLimit';

import { DELETE_CONFIRM_WORD, matchesDeleteWord } from './deleteAccount';
import { LiveText } from '@/components/LiveText';

const PASSWORD_CODES = new Set([
  'Identity.InvalidCredentials',
  'Identity.PasswordIncorrect',
  'Identity.PasswordRequired',
]);

/**
 * `/profile/delete-account`: says in plain Turkish what happens, then asks for the word "SİL" (and the password of an
 * account that has one). `DELETE /me` answers 202: the session is dropped like a logout and the user lands on the login
 * screen with a toast holding the date everything goes.
 */
export function DeleteAccountScreen() {
  const router = useRouter();
  const hasPassword = useHasPassword();
  // A Google/Apple account has no password to ask for. When this session cannot tell, the field is shown but not
  // required: the backend answers `Identity.PasswordRequired`, which lands on the field.
  const showPassword = hasPassword !== false;
  const passwordRequired = hasPassword === true;

  const [word, setWord] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = matchesDeleteWord(word) && (!passwordRequired || password.length > 0);

  const submit = async () => {
    if (!canSubmit || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setPasswordError(null);
    try {
      const response = await deleteAccount({
        password: showPassword && password ? password : null,
        confirm: DELETE_CONFIRM_WORD,
      });
      // The server has ended every session already, so there is nothing to log out of: only this phone forgets.
      await clearLocalSession();
      showToast(tr.deleteScheduledToast(formatDayMonthYear(response.deletionScheduledFor)));
      router.replace('/login');
    } catch (failure) {
      if (failure instanceof ApiError && failure.errorCode === 'Identity.PasswordRequired') {
        setPasswordError(tr.deletePasswordRequired);
      } else if (failure instanceof ApiError && PASSWORD_CODES.has(failure.errorCode ?? '')) {
        setPasswordError(tr.deletePasswordWrong);
      } else if (failure instanceof ApiError && failure.isNetworkError) {
        setError(tr.errorNetwork);
      } else {
        setError(rateLimitedText(failure) ?? tr.errorBody);
      }
      setBusy(false);
    }
  };

  return (
    <Screen scroll padded={false}>
      <SocialHeader title={tr.deleteTitle} fallback="/profile" />
      <View style={styles.content}>
        <View style={styles.steps}>
          <Text style={styles.intro}>{tr.deleteIntro}</Text>
          {[tr.deleteStepEverything, tr.deleteStepPosts, tr.deleteStepCancel].map((step) => (
            <View key={step} style={styles.step}>
              <Text
                style={styles.bullet}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                •
              </Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        <TextField
          label={tr.deleteConfirmLabel}
          value={word}
          onChangeText={setWord}
          placeholder={tr.deleteConfirmPlaceholder}
          autoCapitalize="characters"
          autoCorrect={false}
          testID="delete-word"
        />
        {showPassword ? (
          <TextField
            label={tr.authFieldPassword}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError(null);
            }}
            error={passwordError ?? undefined}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            testID="delete-password"
          />
        ) : null}
        {error ? (
          <LiveText style={styles.error} testID="delete-error">
            {error}
          </LiveText>
        ) : null}
        <Button
          label={tr.deleteSubmit}
          variant="danger"
          onPress={() => void submit()}
          accessibilityHint={canSubmit ? undefined : tr.a11yDeleteHint}
          disabled={!canSubmit}
          loading={busy}
          testID="delete-submit"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.xl,
  },
  steps: {
    gap: theme.spacing.sm,
  },
  intro: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  step: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  bullet: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  stepText: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  error: {
    ...theme.typography.bodyMedium,
    color: theme.colors.danger,
  },
});
