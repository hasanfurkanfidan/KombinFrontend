import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { ToggleRow } from '@/components/ToggleRow';
import { OCCASIONS, type OccasionValue } from '@/features/outfits/labels';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatAmount, formatTry } from '@/utils/money';

import {
  BUDGET_AUDIENCES,
  QUICK_AMOUNTS,
  dateOptions,
  parseAmount,
  sanitizeAmount,
  validateBudget,
  type BudgetErrors,
  type BudgetForm,
} from './form';
import { LiveText } from '@/components/LiveText';

interface BudgetSheetProps {
  visible: boolean;
  onClose: () => void;
  /** What the sheet starts with: the last submitted form, or an empty one. */
  initial: BudgetForm;
  signedIn: boolean;
  /** The wardrobe holds shoes: "Ayakkabım var" starts on until the user touches it. */
  hasShoes: boolean;
  onSubmit: (form: BudgetForm) => void;
}

/**
 * The budget in liras, where, when, and what is already owned. A visitor is asked for the audience instead and never
 * sees the wardrobe row. Validated on submit: the message sits next to the field that is wrong.
 */
export function BudgetSheet({
  visible,
  onClose,
  initial,
  signedIn,
  hasShoes,
  onSubmit,
}: BudgetSheetProps) {
  const [form, setForm] = useState<BudgetForm>(initial);
  // Until the user flips "Ayakkabım var" the wardrobe decides, so a slow stats answer still sets the default.
  const [shoesChoice, setShoesChoice] = useState<boolean | null>(
    initial.amount === '' ? null : initial.haveShoes,
  );
  const [errors, setErrors] = useState<BudgetErrors>({});
  const dates = useMemo(() => dateOptions(new Date()), []);
  const haveShoes = shoesChoice ?? (signedIn && hasShoes);
  const amount = parseAmount(form.amount);

  const patch = (next: Partial<BudgetForm>) => setForm((current) => ({ ...current, ...next }));

  const submit = () => {
    const next = { ...form, haveShoes };
    const found = validateBudget(next, signedIn);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit(next);
    }
  };

  return (
    <BottomSheet visible={visible} title={tr.budgetSheetTitle} onClose={onClose}>
      <TextField
        label={tr.budgetAmountLabel}
        value={form.amount === '' ? '' : formatAmount(Number(form.amount))}
        onChangeText={(text) => {
          patch({ amount: sanitizeAmount(text) });
          setErrors((current) => ({ ...current, amount: undefined }));
        }}
        keyboardType="number-pad"
        placeholder={tr.budgetAmountPlaceholder}
        hint={tr.budgetAmountHint}
        error={errors.amount}
        maxLength={7}
        testID="budget-amount"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_AMOUNTS.map((quick) => (
          <Chip
            key={quick}
            label={formatTry(quick)}
            selected={amount === quick}
            onPress={() => {
              patch({ amount: String(quick) });
              setErrors((current) => ({ ...current, amount: undefined }));
            }}
            testID={`budget-quick-${quick}`}
          />
        ))}
      </ScrollView>

      {signedIn ? null : (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{tr.budgetAudienceLabel}</Text>
          <View style={styles.wrap}>
            {BUDGET_AUDIENCES.map((audience) => (
              <Chip
                key={audience.value}
                label={audience.label}
                selected={form.audience === audience.value}
                onPress={() => {
                  patch({ audience: audience.value });
                  setErrors((current) => ({ ...current, audience: undefined }));
                }}
                testID={`budget-audience-${audience.value}`}
              />
            ))}
          </View>
          {errors.audience ? (
            <LiveText
              style={styles.error}

              testID="budget-audience-error"
            >
              {errors.audience}
            </LiveText>
          ) : null}
        </View>
      )}

      <View style={styles.group}>
        <Text style={styles.groupLabel}>{tr.outfitOccasionLabel}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {OCCASIONS.map((occasion) => (
            <Chip
              key={occasion.value}
              label={occasion.label}
              selected={form.occasion === occasion.value}
              onPress={() =>
                patch({
                  occasion:
                    form.occasion === occasion.value
                      ? undefined
                      : (occasion.value as OccasionValue),
                })
              }
              testID={`budget-occasion-${occasion.value}`}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>{tr.budgetDateLabel}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {dates.map((date) => (
            <Chip
              key={date.value}
              label={date.label}
              accessibilityLabel={date.spoken}
              selected={form.date === date.value}
              onPress={() => patch({ date: date.value })}
              testID={`budget-date-${date.value}`}
            />
          ))}
        </ScrollView>
      </View>

      {signedIn ? (
        <ToggleRow
          title={tr.budgetUseWardrobe}
          caption={tr.budgetUseWardrobeCaption}
          value={form.useWardrobe}
          onChange={(value) => patch({ useWardrobe: value })}
          testID="budget-use-wardrobe"
        />
      ) : null}
      <ToggleRow
        title={tr.budgetHaveShoes}
        caption={tr.budgetHaveShoesCaption}
        value={haveShoes}
        onChange={setShoesChoice}
        testID="budget-have-shoes"
      />

      <Button label={tr.budgetSubmit} onPress={submit} testID="budget-submit" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  group: {
    gap: theme.spacing.sm,
  },
  groupLabel: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
});
