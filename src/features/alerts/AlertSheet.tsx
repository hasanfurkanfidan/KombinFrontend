import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { AlertKind, CreateAlertRequest, Product } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { showToast } from '@/components/toastStore';
import { TextField } from '@/components/TextField';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { useCreateAlert } from './hooks';
import { prefillTarget, validateTarget, type TargetError } from './target';

interface AlertSheetProps {
  visible: boolean;
  onClose: () => void;
  product: Pick<Product, 'id' | 'offers' | 'priceSummary'>;
  /** Called after the alert was created (the screen then offers the push prompt). */
  onCreated: () => void;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

/** Sizes from the offers' `availableSizes`, smallest first: letter sizes in order, then numeric ones. */
export function collectSizes(offers: Product['offers']): string[] {
  const all = new Set(offers.flatMap((offer) => offer.availableSizes));
  const rank = (size: string) => {
    const letter = SIZE_ORDER.indexOf(size.toUpperCase());
    return letter >= 0 ? letter : SIZE_ORDER.length;
  };
  return [...all].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'tr', { numeric: true }));
}

const OPTIONS: { kind: AlertKind; label: string }[] = [
  { kind: 'PriceDrop', label: tr.alertOptionPrice },
  { kind: 'BackInStock', label: tr.alertOptionStock },
  { kind: 'AnyChange', label: tr.alertOptionAny },
];

/** "Alarm kur": pick what to be told about, then `POST /me/alerts`. */
export function AlertSheet({ visible, onClose, product, onCreated }: AlertSheetProps) {
  const lowest =
    product.priceSummary.lowestNow === null ? null : toNumber(product.priceSummary.lowestNow);
  const sizes = collectSizes(product.offers);
  const createAlert = useCreateAlert();

  const [kind, setKind] = useState<AlertKind>(lowest === null ? 'BackInStock' : 'PriceDrop');
  const [targetText, setTargetText] = useState(
    lowest === null ? '' : String(prefillTarget(lowest)),
  );
  const [chosenSizes, setChosenSizes] = useState<string[]>([]);
  const [targetError, setTargetError] = useState<TargetError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleSize = (size: string) =>
    setChosenSizes((current) =>
      current.includes(size) ? current.filter((item) => item !== size) : [...current, size],
    );

  const submit = () => {
    let body: CreateAlertRequest;
    if (kind === 'PriceDrop') {
      const result = validateTarget(targetText, lowest ?? 0);
      setTargetError(result.error);
      if (result.error || result.value === null) {
        return;
      }
      body = { productId: product.id, kind, targetPrice: result.value, sizes: null };
    } else if (kind === 'BackInStock') {
      body = { productId: product.id, kind, targetPrice: null, sizes: chosenSizes };
    } else {
      body = { productId: product.id, kind, targetPrice: null, sizes: null };
    }
    setFormError(null);
    createAlert.mutate(body, {
      onSuccess: () => {
        onClose();
        onCreated();
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          showToast(tr.alertExists);
          onClose();
        } else if (
          error instanceof ApiError &&
          error.errorCode === 'Engagement.TargetNotBelowCurrent'
        ) {
          setTargetError('notBelow');
        } else {
          setFormError(
            error instanceof ApiError && error.isNetworkError ? tr.errorNetwork : tr.alertFailed,
          );
        }
      },
    });
  };

  const targetMessage =
    targetError === 'required'
      ? tr.alertTargetRequired
      : targetError === 'invalid'
        ? tr.alertTargetInvalid
        : targetError === 'notBelow' && lowest !== null
          ? tr.alertTargetNotBelow(formatTry(lowest))
          : undefined;

  return (
    <BottomSheet visible={visible} title={tr.alertSheetTitle} onClose={onClose}>
      {OPTIONS.map((option) => {
        const disabled = option.kind === 'PriceDrop' && lowest === null;
        const selected = kind === option.kind;
        return (
          <Pressable
            key={option.kind}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => setKind(option.kind)}
            style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}
            testID={`alert-kind-${option.kind}`}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.optionLabel}>{option.label}</Text>
          </Pressable>
        );
      })}

      {kind === 'PriceDrop' && lowest !== null ? (
        <TextField
          label={tr.alertTargetLabel}
          value={targetText}
          onChangeText={(text) => {
            setTargetText(text);
            setTargetError(null);
          }}
          keyboardType="decimal-pad"
          error={targetMessage}
          hint={tr.alertTargetCurrent(formatTry(lowest))}
          testID="alert-target"
        />
      ) : null}

      {kind === 'BackInStock' ? (
        <View style={styles.sizes}>
          <Text style={styles.sizesLabel}>{tr.alertSizesLabel}</Text>
          {sizes.length === 0 ? (
            <Text style={styles.sizesHint}>{tr.alertSizesNone}</Text>
          ) : (
            <View style={styles.sizeChips}>
              {sizes.map((size) => (
                <Chip
                  key={size}
                  label={size}
                  selected={chosenSizes.includes(size)}
                  onPress={() => toggleSize(size)}
                  testID={`alert-size-${size}`}
                />
              ))}
            </View>
          )}
          <Text style={styles.sizesHint}>{tr.alertSizesHint}</Text>
        </View>
      ) : null}

      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <Button
        label={tr.alertSubmit}
        onPress={submit}
        loading={createAlert.isPending}
        testID="alert-submit"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: theme.sizes.touch + theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionSelected: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surfaceAlt,
  },
  disabled: {
    opacity: 0.4,
  },
  optionLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: theme.colors.ink,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  sizes: {
    gap: theme.spacing.sm,
  },
  sizesLabel: {
    ...theme.typography.captionMedium,
    color: theme.colors.inkSoft,
  },
  sizesHint: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  sizeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.warning,
  },
});
