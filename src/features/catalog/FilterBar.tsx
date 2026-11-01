import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import type { Audience, ProductColor } from '@/api/models';
import { Chip } from '@/components/Chip';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import {
  audienceLabels,
  colorLabels,
  SORT_VALUES,
  sortLabels,
  type ProductFilters,
  type SortValue,
} from './filters';
import { useCategories } from './hooks';
import { OptionSheet, type Option } from './OptionSheet';

interface FilterBarProps {
  filters: ProductFilters;
  onChange: (next: ProductFilters) => void;
}

type Picker = 'color' | 'audience' | 'sort';

/** Sentinel option that clears a picker's filter. */
const ALL = 'all';

const allOption = { value: ALL, label: tr.filterAll } as const;
const colorOptions: Option<ProductColor | typeof ALL>[] = [
  allOption,
  ...(Object.keys(colorLabels) as ProductColor[]).map((value) => ({
    value,
    label: colorLabels[value],
  })),
];
const audienceOptions: Option<Audience | typeof ALL>[] = [
  allOption,
  ...(Object.keys(audienceLabels) as Audience[]).map((value) => ({
    value,
    label: audienceLabels[value],
  })),
];
const sortOptions: Option<SortValue>[] = SORT_VALUES.map((value) => ({
  value,
  label: sortLabels[value],
}));

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [picker, setPicker] = useState<Picker | null>(null);
  const categories = useCategories();
  const close = () => setPicker(null);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <Chip
          label={tr.filterAll}
          selected={!filters.categorySlug}
          onPress={() => onChange({ ...filters, categorySlug: undefined })}
          testID="filter-category-all"
        />
        {(categories.data ?? []).map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            selected={filters.categorySlug === category.slug}
            onPress={() =>
              onChange({
                ...filters,
                categorySlug: filters.categorySlug === category.slug ? undefined : category.slug,
              })
            }
            testID={`filter-category-${category.slug}`}
          />
        ))}
        <Chip
          label={filters.color ? colorLabels[filters.color] : tr.filterColor}
          selected={Boolean(filters.color)}
          dropdown
          onPress={() => setPicker('color')}
          testID="filter-color"
        />
        <Chip
          label={filters.audience ? audienceLabels[filters.audience] : tr.filterAudience}
          selected={Boolean(filters.audience)}
          dropdown
          onPress={() => setPicker('audience')}
          testID="filter-audience"
        />
        <Chip
          label={filters.sort ? sortLabels[filters.sort] : tr.filterSort}
          selected={Boolean(filters.sort)}
          dropdown
          onPress={() => setPicker('sort')}
          testID="filter-sort"
        />
      </ScrollView>

      <OptionSheet
        visible={picker === 'color'}
        title={tr.filterColor}
        options={colorOptions}
        selected={filters.color ?? ALL}
        onSelect={(value) => {
          onChange({ ...filters, color: value === ALL ? undefined : value });
          close();
        }}
        onClose={close}
      />
      <OptionSheet
        visible={picker === 'audience'}
        title={tr.filterAudience}
        options={audienceOptions}
        selected={filters.audience ?? ALL}
        onSelect={(value) => {
          onChange({ ...filters, audience: value === ALL ? undefined : value });
          close();
        }}
        onClose={close}
      />
      <OptionSheet
        visible={picker === 'sort'}
        title={tr.filterSort}
        options={sortOptions}
        selected={filters.sort ?? 'relevance'}
        onSelect={(value) => {
          onChange({ ...filters, sort: value === 'relevance' ? undefined : value });
          close();
        }}
        onClose={close}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: theme.screenPaddingX,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
});
