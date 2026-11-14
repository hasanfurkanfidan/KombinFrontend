import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { getAnonymousId } from '@/analytics';
import { ApiError } from '@/api/client';
import { login } from '@/api/endpoints/auth';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { tr } from '@/i18n/tr';
import { completeSignIn } from '@/session/useSession';
import { theme } from '@/theme';
import { rateLimitedText } from '@/utils/rateLimit';

import { accountDisabledMessage } from './accountMessages';
import { applyFieldErrors } from './formErrors';
import { isAccountDisabled, isPendingDeletion, usePendingDeletionStore } from './pendingDeletion';
import { loginSchema, type LoginValues } from './schemas';

interface LoginFormProps {
  onSuccess: () => void;
  /** The password was right but the account is waiting to be deleted: the screen offers to cancel it. */
  onPendingDeletion: () => void;
}

export function LoginForm({ onSuccess, onPendingDeletion }: LoginFormProps) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await completeSignIn(
        await login({ ...values, anonymousId: await getAnonymousId() }),
        'password',
      );
      onSuccess();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError('root', { message: tr.errorBody });
      } else if (isPendingDeletion(error)) {
        usePendingDeletionStore.getState().begin(error.deletionScheduledFor, {
          kind: 'password',
          email: values.email,
          password: values.password,
        });
        onPendingDeletion();
      } else if (isAccountDisabled(error)) {
        setError('root', { message: await accountDisabledMessage() });
      } else if (error.isRateLimited) {
        setError('root', { message: rateLimitedText(error) ?? tr.errorBody });
      } else if (error.errorCode === 'Identity.InvalidCredentials') {
        setError('root', { message: tr.authInvalidCredentials });
      } else if (!applyFieldErrors(error, setError, ['email', 'password'])) {
        setError('root', { message: error.detail ?? tr.errorBody });
      }
    }
  });

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label={tr.authFieldEmail}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            testID="login-email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label={tr.authFieldPassword}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            testID="login-password"
          />
        )}
      />
      {errors.root?.message ? (
        <Text style={styles.formError} accessibilityLiveRegion="polite">
          {errors.root.message}
        </Text>
      ) : null}
      <Button
        label={tr.authLoginSubmit}
        onPress={() => void submit()}
        loading={isSubmitting}
        testID="login-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.lg,
  },
  formError: {
    ...theme.typography.bodyMedium,
    color: theme.colors.danger,
  },
});
