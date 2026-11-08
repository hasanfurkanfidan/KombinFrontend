import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import {
  externalSignInMessage,
  externalSignInSupported,
  loadAppleAuthentication,
  signInWithApple,
  signInWithGoogle,
  type ExternalProvider,
  type ExternalSignInResult,
} from './externalSignIn';

interface ExternalSignInButtonsProps {
  /** Called after the tokens are stored. `result.isNewUser` is informational: onboarding is `OnboardingGate`'s job. */
  onSuccess: (result: ExternalSignInResult) => void;
}

type AppleModule = NonNullable<Awaited<ReturnType<typeof loadAppleAuthentication>>>;

/**
 * "Google ile devam et" (always) and "Apple ile devam et" (iOS with Apple sign-in available), then the "veya"
 * divider, for the top of the sign-in and register screens. Renders nothing where the native modules do not exist
 * (Expo Go, web), so the e-mail form stands alone there.
 */
export function ExternalSignInButtons({ onSuccess }: ExternalSignInButtonsProps) {
  const supported = externalSignInSupported();
  const [apple, setApple] = useState<AppleModule | null>(null);
  const [busy, setBusy] = useState<ExternalProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) {
      return;
    }
    let active = true;
    void loadAppleAuthentication().then((module) => {
      if (active) {
        setApple(module);
      }
    });
    return () => {
      active = false;
    };
  }, [supported]);

  if (!supported) {
    return null;
  }

  async function run(provider: ExternalProvider) {
    if (busy) {
      return;
    }
    setBusy(provider);
    setError(null);
    try {
      const result = await (provider === 'google' ? signInWithGoogle() : signInWithApple());
      // `null` means the user closed the sheet: that is not an error, so there is nothing to show.
      if (result) {
        onSuccess(result);
      }
    } catch (failure) {
      setError(externalSignInMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.buttons}>
        <Button
          variant="secondary"
          label={tr.authExternalGoogle}
          leading={<Text style={styles.googleMark}>G</Text>}
          onPress={() => void run('google')}
          loading={busy === 'google'}
          disabled={busy !== null}
          testID="external-google"
        />
        {apple ? (
          <apple.AppleAuthenticationButton
            buttonType={apple.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={apple.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={theme.radius.lg}
            onPress={() => void run('apple')}
            style={[styles.appleButton, busy !== null && styles.dimmed]}
          />
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID="external-error">
          {error}
        </Text>
      ) : null}
      <View style={styles.divider}>
        <View style={styles.rule} />
        <Text style={styles.dividerLabel}>{tr.authExternalDivider}</Text>
        <View style={styles.rule} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.lg,
  },
  buttons: {
    gap: theme.spacing.md,
  },
  googleMark: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  appleButton: {
    height: theme.sizes.buttonHeight,
    width: '100%',
  },
  dimmed: {
    opacity: 0.6,
  },
  error: {
    ...theme.typography.bodyMedium,
    color: theme.colors.warning,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerLabel: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
});
