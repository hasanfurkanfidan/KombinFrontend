import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { ApiError } from '@/api/client';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/toastStore';
import { applyFieldErrors } from '@/features/auth/formErrors';
import { useCreatePersona } from '@/features/personas/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { CUSTOM_PERSONA_ICON, PERSONA_PRESETS, type OnboardingFlow } from './flow';
import { OnboardingFrame } from './OnboardingFrame';

export const personaNameSchema = z.object({
  name: z.string().trim().min(2, tr.personaNameLength).max(40, tr.personaNameLength),
});

type PersonaNameValues = z.infer<typeof personaNameSchema>;

interface PersonaNameScreenProps {
  flow: OnboardingFlow;
  returnTo?: string;
}

/**
 * Step 1 of a new style ("Yeni tarz ekle" on Keşfet, "Yeni tarz oluştur" on Profil): a name from the chips or free
 * text → `POST /me/personas`. The first run has no naming step (its style is "Tarzım").
 */
export function PersonaNameScreen({ flow, returnTo }: PersonaNameScreenProps) {
  const router = useRouter();
  const createPersona = useCreatePersona();
  // The icon is the chip's key while the text still equals that chip, `custom` once the user types their own.
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PersonaNameValues>({
    resolver: zodResolver(personaNameSchema),
    defaultValues: { name: '' },
  });

  const submit = handleSubmit(async ({ name }) => {
    const preset = PERSONA_PRESETS.find((item) => item.key === presetKey);
    const icon = preset && preset.label === name ? preset.key : CUSTOM_PERSONA_ICON;
    try {
      const persona = await createPersona.mutateAsync({ name, icon });
      router.push({ pathname: '/swipe', params: { personaId: persona.id, flow, returnTo } });
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError('root', { message: tr.errorBody });
      } else if (error.errorCode === 'Profile.PersonaNameTaken') {
        setError('name', { message: tr.personaNameTaken });
      } else if (error.errorCode === 'Profile.PersonaLimit') {
        showToast(tr.personaLimit);
      } else if (!applyFieldErrors(error, setError, ['name'])) {
        setError('root', { message: error.detail ?? tr.errorBody });
      }
    }
  });

  return (
    <OnboardingFrame
      flow={flow}
      step={1}
      title={tr.onboardingNewPersonaTitle}
      subtitle={tr.onboardingPersonaSubtitle}
      returnTo={returnTo}
    >
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <View style={styles.form}>
            <View style={styles.chips}>
              {PERSONA_PRESETS.map((preset) => (
                <Chip
                  key={preset.key}
                  label={preset.label}
                  selected={field.value === preset.label}
                  onPress={() => {
                    setPresetKey(preset.key);
                    field.onChange(preset.label);
                  }}
                  testID={`persona-preset-${preset.key}`}
                />
              ))}
            </View>
            <TextField
              label={tr.personaNameLabel}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.name?.message}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              testID="persona-name"
            />
          </View>
        )}
      />
      {errors.root?.message ? <Text style={styles.error}>{errors.root.message}</Text> : null}
      <Button
        label={tr.onboardingContinue}
        onPress={() => void submit()}
        loading={createPersona.isPending}
        testID="persona-submit"
      />
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.warning,
  },
});
