import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SizeGroup } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/toastStore';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { useBrandSearch, useUpsertSize } from './hooks';

export const sizeGroupLabels: Record<SizeGroup, string> = {
  Tops: tr.sizeGroupTops,
  Bottoms: tr.sizeGroupBottoms,
  Outerwear: tr.sizeGroupOuterwear,
  Shoes: tr.sizeGroupShoes,
  Accessories: tr.sizeGroupAccessories,
};

const GROUPS = Object.keys(sizeGroupLabels) as SizeGroup[];

interface BrandChoice {
  slug: string;
  name: string;
}

interface SizeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-selected brand and group, e.g. the product's own brand on the detail screen. */
  initial?: { brand?: BrandChoice; group?: SizeGroup };
}

/** "Bedenini ekle": brand search, size group chips and a size field, saved with `PUT /me/sizes`. */
export function SizeSheet({ visible, onClose, initial }: SizeSheetProps) {
  // The form is only mounted while the modal is open, so every opening starts from `initial`.
  return (
    <BottomSheet visible={visible} title={tr.sizeSheetTitle} onClose={onClose}>
      <SizeForm onClose={onClose} initial={initial} />
    </BottomSheet>
  );
}

function SizeForm({ onClose, initial }: Pick<SizeSheetProps, 'onClose' | 'initial'>) {
  const [brand, setBrand] = useState<BrandChoice | null>(initial?.brand ?? null);
  const [group, setGroup] = useState<SizeGroup>(initial?.group ?? 'Tops');
  const [query, setQuery] = useState('');
  const [size, setSize] = useState('');
  const [errors, setErrors] = useState<{ brand?: string; size?: string }>({});
  const upsert = useUpsertSize();
  const results = useBrandSearch(brand ? '' : query);

  const submit = () => {
    const next = {
      brand: brand ? undefined : tr.sizeBrandRequired,
      size: size.trim() ? undefined : tr.sizeValueRequired,
    };
    setErrors(next);
    if (!brand || !size.trim()) {
      return;
    }
    upsert.mutate(
      { brandSlug: brand.slug, group, size: size.trim() },
      {
        onSuccess: onClose,
        onError: () => showToast(tr.sizeSaveFailed),
      },
    );
  };

  return (
    <>
      {brand ? (
        <View style={styles.selectedBrand}>
          <Text style={styles.label}>{tr.sizeBrandLabel}</Text>
          <Chip
            label={brand.name}
            selected
            onPress={() => setBrand(null)}
            testID="size-brand-selected"
          />
        </View>
      ) : (
        <View style={styles.brandSearch}>
          <TextField
            label={tr.sizeBrandLabel}
            value={query}
            onChangeText={setQuery}
            placeholder={tr.sizeBrandSearchPlaceholder}
            autoCorrect={false}
            error={errors.brand}
            testID="size-brand-search"
          />
          {query.trim() && results.data ? (
            results.data.length === 0 ? (
              <Text style={styles.hint}>{tr.sizeBrandNone}</Text>
            ) : (
              results.data.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => setBrand({ slug: item.slug, name: item.name })}
                  style={styles.brandRow}
                  testID={`size-brand-${item.slug}`}
                >
                  <Text style={styles.brandName}>{item.name}</Text>
                </Pressable>
              ))
            )
          ) : null}
        </View>
      )}

      <View style={styles.groupBlock}>
        <Text style={styles.label}>{tr.sizeGroupLabel}</Text>
        <View style={styles.groups}>
          {GROUPS.map((item) => (
            <Chip
              key={item}
              label={sizeGroupLabels[item]}
              selected={group === item}
              onPress={() => setGroup(item)}
              testID={`size-group-${item}`}
            />
          ))}
        </View>
      </View>

      <TextField
        label={tr.sizeValueLabel}
        value={size}
        onChangeText={setSize}
        placeholder={tr.sizeValuePlaceholder}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={20}
        error={errors.size}
        testID="size-value"
      />
      <Button label={tr.save} onPress={submit} loading={upsert.isPending} testID="size-submit" />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...theme.typography.captionMedium,
    color: theme.colors.inkSoft,
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  selectedBrand: {
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  brandSearch: {
    gap: theme.spacing.xs,
  },
  brandRow: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  brandName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  groupBlock: {
    gap: theme.spacing.sm,
  },
  groups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
});
