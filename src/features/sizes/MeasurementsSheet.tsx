import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import type { Profile } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { toUpdateRequest, useUpdateProfile } from '@/features/profile/hooks';

import {
  measurementsSchema,
  type MeasurementsInput,
  type MeasurementsOutput,
} from './measurementsSchema';

const FIELDS = [
  { name: 'heightCm', label: tr.measurementHeight, unit: tr.measurementUnitCm },
  { name: 'weightKg', label: tr.measurementWeight, unit: tr.measurementUnitKg },
  { name: 'chestCm', label: tr.measurementChest, unit: tr.measurementUnitCm },
  { name: 'waistCm', label: tr.measurementWaist, unit: tr.measurementUnitCm },
] as const;

function toText(value: number | string | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

function defaultsFrom(profile: Profile): MeasurementsInput {
  return {
    heightCm: toText(profile.heightCm),
    weightKg: toText(profile.weightKg),
    chestCm: toText(profile.chestCm),
    waistCm: toText(profile.waistCm),
    city: profile.city ?? '',
  };
}

interface MeasurementsSheetProps {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
}

/** "Ölçüleri güncelle": boy / kilo / göğüs / bel with the backend's ranges, and the city for the weather; saved with `PUT /me/profile`. */
export function MeasurementsSheet({ visible, onClose, profile }: MeasurementsSheetProps) {
  const update = useUpdateProfile();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<MeasurementsInput, unknown, MeasurementsOutput>({
    resolver: zodResolver(measurementsSchema),
    defaultValues: defaultsFrom(profile),
  });

  // Start from the stored values every time the sheet opens.
  useEffect(() => {
    if (visible) {
      reset(defaultsFrom(profile));
    }
  }, [visible, profile, reset]);

  const submit = handleSubmit((values) =>
    update.mutateAsync(toUpdateRequest(profile, values)).then(
      () => onClose(),
      () => setError('root', { message: tr.measurementSaveFailed }),
    ),
  );

  return (
    <BottomSheet visible={visible} title={tr.measurementsSheetTitle} onClose={onClose}>
      {FIELDS.map(({ name, label, unit }) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field }) => (
            <View>
              <TextField
                label={`${label} (${unit})`}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                error={errors[name]?.message}
                testID={`measurement-${name}`}
              />
            </View>
          )}
        />
      ))}
      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <View>
            <TextField
              label={tr.profileCityLabel}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={tr.profileCityPlaceholder}
              autoCapitalize="words"
              hint={tr.profileCityHint}
              error={errors.city?.message}
              testID="profile-city"
            />
          </View>
        )}
      />
      {errors.root?.message ? <Text style={styles.error}>{errors.root.message}</Text> : null}
      <Button
        label={tr.save}
        onPress={() => void submit()}
        loading={update.isPending}
        testID="measurements-save"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  error: {
    ...theme.typography.caption,
    color: theme.colors.warning,
  },
});
