import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { register } from '@/api/endpoints/auth';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { tr } from '@/i18n/tr';
import { completeSignIn } from '@/session/useSession';
import { theme } from '@/theme';

import { applyFieldErrors } from './formErrors';
import { registerSchema, type RegisterValues } from './schemas';

interface RegisterFormProps {
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await completeSignIn(await register(values));
      onSuccess();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError('root', { message: tr.errorBody });
      } else if (error.errorCode === 'Identity.EmailTaken') {
        setError('email', { message: tr.authEmailTaken });
      } else if (!applyFieldErrors(error, setError, ['displayName', 'email', 'password'])) {
        setError('root', { message: error.detail ?? tr.errorBody });
      }
    }
  });

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label={tr.authFieldDisplayName}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            testID="register-name"
          />
        )}
      />
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
            testID="register-email"
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
            hint={tr.authPasswordHint}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            testID="register-password"
          />
        )}
      />
      {errors.root?.message ? (
        <Text style={styles.formError} accessibilityLiveRegion="polite">
          {errors.root.message}
        </Text>
      ) : null}
      <Button
        label={tr.authRegisterSubmit}
        onPress={() => void submit()}
        loading={isSubmitting}
        testID="register-submit"
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
    color: theme.colors.warning,
  },
});
