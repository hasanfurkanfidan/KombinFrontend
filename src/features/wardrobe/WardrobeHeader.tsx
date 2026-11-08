import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import type { ProductColor, WardrobeGaps, WardrobeStats } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { colorLabels } from '@/features/catalog/filters';
import { OptionSheet, type Option } from '@/features/catalog/OptionSheet';
import { ProductCard } from '@/features/catalog/ProductCard';
import { productHref } from '@/features/catalog/productLink';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import type { ItemFilters } from './hooks';
import { CATEGORY_GROUPS } from './labels';

const ALL = 'all';
const colorOptions: Option<ProductColor | typeof ALL>[] = [
  { value: ALL, label: tr.filterAll },
  ...(Object.keys(colorLabels) as ProductColor[]).map((value) => ({
    value,
    label: colorLabels[value],
  })),
];

interface StatsRowProps {
  stats: WardrobeStats | undefined;
  /** Ready pieces that pair with nothing; `undefined` while they are being counted. */
  unmatched: number | undefined;
  /** The grid shows only those pieces. */
  unmatchedActive: boolean;
  onToggleUnmatched: () => void;
}

/**
 * One sentence instead of three bare numbers: "12 parçanla 38 kombin çıkıyor; 3 parçanın henüz eşi yok." The second
 * clause is a filter: pressed, the grid shows only those pieces (they are what the gap card should help with).
 * Nothing is shown while the stats load or when the wardrobe is empty (its empty state says it all).
 */
export function StatsRow({ stats, unmatched, unmatchedActive, onToggleUnmatched }: StatsRowProps) {
  if (!stats || toNumber(stats.itemCount) === 0) {
    return null;
  }
  const items = toNumber(stats.itemCount);
  const outfits = stats.possibleOutfits;
  const lead =
    outfits === null || outfits === undefined
      ? tr.wardrobeSummaryItems(items)
      : tr.wardrobeSummaryOutfits(items, toNumber(outfits));

  let tail = null;
  if (unmatched === 0 && !unmatchedActive) {
    tail = `; ${tr.wardrobeSummaryAllPaired}`;
  } else if (unmatched !== undefined) {
    tail = (
      <>
        {'; '}
        <Text
          accessibilityRole="button"
          accessibilityState={{ selected: unmatchedActive }}
          onPress={onToggleUnmatched}
          style={styles.summaryLink}
          testID="stat-unmatched"
        >
          {unmatchedActive ? tr.wardrobeSummaryShowAll : tr.wardrobeSummaryUnpaired(unmatched)}
        </Text>
      </>
    );
  }

  return (
    <Text style={styles.summary} testID="wardrobe-stats">
      {lead}
      {tail}.
    </Text>
  );
}

/** The black card for the biggest gap; absent when the wardrobe has none. */
export function GapCard({ gaps }: { gaps: WardrobeGaps | undefined }) {
  const [open, setOpen] = useState(false);
  const first = gaps?.gaps[0];
  if (!gaps || !first) {
    return null;
  }
  const unlocks = toNumber(first.unlocksEstimate);
  return (
    <>
      <View style={styles.gapCard} testID="gap-card">
        <View style={styles.gapText}>
          <Text style={styles.gapTitle}>{first.message}</Text>
          {unlocks > 0 ? (
            <Text style={styles.gapBody}>{tr.wardrobeGapUnlocks(unlocks)}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={styles.gapButton}
          testID="gap-suggestions"
        >
          <Text style={styles.gapButtonText}>{tr.wardrobeGapSuggestions}</Text>
        </Pressable>
      </View>
      <GapSuggestionsSheet
        visible={open}
        products={gaps.suggestedProducts}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function GapSuggestionsSheet({
  visible,
  products,
  onClose,
}: {
  visible: boolean;
  products: WardrobeGaps['suggestedProducts'];
  onClose: () => void;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - theme.screenPaddingX * 2 - theme.gridGap) / 2;
  return (
    <BottomSheet visible={visible} title={tr.wardrobeGapSheetTitle} onClose={onClose}>
      {products.length === 0 ? (
        <Text style={styles.sheetEmpty}>{tr.wardrobeGapSheetEmpty}</Text>
      ) : (
        <View style={styles.sheetGrid}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              width={cardWidth}
              onPress={(id) => {
                onClose();
                router.push(productHref(id, 'direct'));
              }}
            />
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

interface FilterChipsProps {
  filters: ItemFilters;
  onChange: (next: ItemFilters) => void;
  /** The "parça eşleşmiyor" filter is on, so "Tümü" is not the selected chip. */
  suspended?: boolean;
}

/** Tümü, the five top-level categories, and a colour chip that opens the colour sheet. */
export function FilterChips({ filters, onChange, suspended = false }: FilterChipsProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const color = filters.color as ProductColor | undefined;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={tr.filterAll}
          selected={!filters.category && !suspended}
          onPress={() => onChange({ ...filters, category: undefined })}
          testID="wardrobe-filter-all"
        />
        {CATEGORY_GROUPS.map((group) => (
          <Chip
            key={group.slug}
            label={group.label}
            selected={filters.category === group.slug}
            onPress={() => onChange({ ...filters, category: group.slug })}
            testID={`wardrobe-filter-${group.slug}`}
          />
        ))}
        <Chip
          label={color ? colorLabels[color] : tr.filterColor}
          selected={Boolean(color)}
          dropdown
          onPress={() => setColorOpen(true)}
          testID="wardrobe-filter-color"
        />
      </ScrollView>
      <OptionSheet
        visible={colorOpen}
        title={tr.filterColor}
        options={colorOptions}
        selected={color ?? ALL}
        onSelect={(value) => {
          onChange({ ...filters, color: value === ALL ? undefined : value });
          setColorOpen(false);
        }}
        onClose={() => setColorOpen(false)}
      />
    </>
  );
}

/** "Parça ekle": the black pill in the header. */
export function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.addButton}
      testID="wardrobe-add"
    >
      <Icon name="camera" size={18} color={theme.colors.onInk} />
      <Text style={styles.addButtonText}>{tr.wardrobeAddButton}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  summaryLink: {
    ...theme.typography.bodyStrong,
    textDecorationLine: 'underline',
  },
  gapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    backgroundColor: theme.colors.ink,
    padding: theme.spacing.xl,
  },
  gapText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  gapTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
  },
  gapBody: {
    ...theme.typography.body,
    color: theme.colors.borderStrong,
  },
  gapButton: {
    minHeight: theme.sizes.touch,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapButtonText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  sheetEmpty: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gridGap,
  },
  chips: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  addButton: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  addButtonText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
  },
});
