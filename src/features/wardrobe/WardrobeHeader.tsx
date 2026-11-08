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

/** The noun for a gap, by the top-level category of its slug ("ust-giyim/blazer" is an "üst"). */
const GAP_NOUNS: Record<string, string> = {
  'ust-giyim': tr.pairingsSlotTop,
  'alt-giyim': tr.pairingsSlotBottom,
  'dis-giyim': tr.wardrobeGapNounOuterwear,
  ayakkabi: tr.pairingsSlotShoes,
  aksesuar: tr.pairingsSlotAccessory,
};

/**
 * The biggest gap as one quiet line: "Bej bir üst 15 kombin daha açar · Önerilere bak". The sentence is built from the
 * gap's colour and category; when the category is unknown or nothing is unlocked, the backend's own message is used.
 */
export function gapHintText(gap: WardrobeGaps['gaps'][number]): string {
  const noun = GAP_NOUNS[gap.categorySlug.split('/')[0] ?? ''];
  const unlocks = toNumber(gap.unlocksEstimate);
  if (!noun || unlocks <= 0) {
    return gap.message;
  }
  const color = gap.color === 'Other' ? null : colorLabels[gap.color];
  const piece = color ? tr.wardrobeGapPiece(color, noun) : tr.wardrobeGapPieceNoColor(noun);
  return tr.wardrobeGapHint(piece, unlocks);
}

/** The biggest gap as a one-line hint under the summary sentence, with the suggestions behind a link; absent without gaps. */
export function GapHint({ gaps }: { gaps: WardrobeGaps | undefined }) {
  const [open, setOpen] = useState(false);
  const first = gaps?.gaps[0];
  if (!gaps || !first) {
    return null;
  }
  return (
    <>
      <Text style={styles.gapHint} testID="gap-hint">
        {gapHintText(first)}
        {' · '}
        <Text
          accessibilityRole="link"
          onPress={() => setOpen(true)}
          style={styles.gapLink}
          testID="gap-suggestions"
        >
          {tr.wardrobeGapSuggestions}
        </Text>
      </Text>
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
  gapHint: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  gapLink: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    textDecorationLine: 'underline',
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
