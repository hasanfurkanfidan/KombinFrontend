import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { priceSchema, type PriceInput, type PriceOutput, type PriceRange } from './priceFilter';

interface PriceSheetProps {
  visible: boolean;
  value: PriceRange;
  onApply: (next: PriceRange) => void;
  onClose: () => void;
}

const toText = (value: number | undefined) => (value === undefined ? '' : String(value));

/** "Fiyat": a lowest and a highest price; a blank field drops that bound. */
export function PriceSheet({ visible, value, onApply, onClose }: PriceSheetProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceInput, unknown, PriceOutput>({
    resolver: zodResolver(priceSchema),
    defaultValues: { minPrice: toText(value.minPrice), maxPrice: toText(value.maxPrice) },
  });

  // Start from the applied range every time the sheet opens.
  const { minPrice, maxPrice } = value;
  useEffect(() => {
    if (visible) {
      reset({ minPrice: toText(minPrice), maxPrice: toText(maxPrice) });
    }
  }, [visible, minPrice, maxPrice, reset]);

  const apply = handleSubmit((range) => onApply(range));

  return (
    <BottomSheet visible={visible} title={tr.searchFilterPrice} onClose={onClose}>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Controller
            control={control}
            name="minPrice"
            render={({ field }) => (
              <TextField
                label={tr.searchPriceMin}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                maxLength={7}
                error={errors.minPrice?.message}
                testID="price-min"
              />
            )}
          />
        </View>
        <View style={styles.field}>
          <Controller
            control={control}
            name="maxPrice"
            render={({ field }) => (
              <TextField
                label={tr.searchPriceMax}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                maxLength={7}
                error={errors.maxPrice?.message}
                testID="price-max"
              />
            )}
          />
        </View>
      </View>
      <Button label={tr.searchPriceApply} onPress={() => void apply()} testID="price-apply" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fields: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  field: {
    flex: 1,
  },
});
