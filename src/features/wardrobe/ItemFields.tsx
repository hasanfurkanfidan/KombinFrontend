import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CategoryNode, ProductColor } from '@/api/models';
import { Chip } from '@/components/Chip';
import { useCategories } from '@/features/catalog/hooks';
import { colorLabels } from '@/features/catalog/filters';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

/**
 * The category chips and colour swatches of the single add's confirm sheet, shared with the bulk add's piece sheet so a
 * piece is edited "exactly as in the single add": same choices, same order, same "Diğer" list, same names.
 */

const COLORS = Object.keys(colorLabels) as ProductColor[];

function leaves(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => (node.children.length > 0 ? leaves(node.children) : [node]));
}

interface CategoryChipsProps {
  label: string;
  /** The photo's own guesses first (best one first), then what the piece already has. */
  suggested: readonly string[];
  /** Names the server already gave for some slugs (a bulk piece's candidates); the category tree names the rest. */
  knownNames?: Readonly<Record<string, string>>;
  value: string | null;
  onChange: (slug: string) => void;
}

export function CategoryChips({ label, suggested, knownNames, value, onChange }: CategoryChipsProps) {
  const categories = useCategories();
  const [showAll, setShowAll] = useState(false);
  const leafList = useMemo(() => leaves(categories.data ?? []), [categories.data]);
  const nameOf = (slug: string) =>
    knownNames?.[slug] ??
    leafList.find((leaf) => leaf.slug === slug)?.name ??
    slug.split('/').pop() ??
    slug;
  const choices = showAll || suggested.length === 0 ? leafList.map((leaf) => leaf.slug) : suggested;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {choices.map((slug) => (
          <Chip
            key={slug}
            label={nameOf(slug)}
            selected={value === slug}
            onPress={() => onChange(slug)}
            testID={`item-category-${slug}`}
          />
        ))}
        {!showAll && suggested.length > 0 ? (
          <Chip
            label={tr.wardrobeCategoryOther}
            onPress={() => setShowAll(true)}
            testID="item-category-other"
          />
        ) : null}
      </View>
    </View>
  );
}

export function ColorSwatches({
  value,
  onChange,
}: {
  value: ProductColor;
  onChange: (color: ProductColor) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{tr.wardrobeColorLabel}</Text>
      <View style={styles.swatches}>
        {COLORS.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={colorLabels[color]}
            accessibilityState={{ selected: value === color }}
            hitSlop={(theme.sizes.touch - theme.sizes.colorSwatch) / 2}
            onPress={() => onChange(color)}
            style={[
              styles.swatch,
              { backgroundColor: theme.colorNames[color] },
              value === color && styles.swatchSelected,
            ]}
            testID={`item-color-${color}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.typography.captionStrong,
    color: theme.colors.ink2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  swatch: {
    width: theme.sizes.colorSwatch,
    height: theme.sizes.colorSwatch,
    borderRadius: theme.sizes.colorSwatch / 2,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
});
