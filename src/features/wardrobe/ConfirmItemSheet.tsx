import { useMemo, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  BrandRef,
  CategoryNode,
  ProductColor,
  ProductFit,
  ProductPattern,
  UpdateWardrobeItemRequest,
  WardrobeItem,
} from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/toastStore';
import { useCategories } from '@/features/catalog/hooks';
import { colorLabels } from '@/features/catalog/filters';
import { useBrandSearch } from '@/features/sizes/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { toNumber } from '@/utils/money';

import { useArchiveItem, useUpdateItem, useWardrobeItem } from './hooks';
import {
  FORMALITY_LABELS,
  SEASONS,
  fitLabels,
  patternLabels,
  seasonLabels,
  warningHint,
  type Season,
} from './labels';

const COLORS = Object.keys(colorLabels) as ProductColor[];
const PATTERNS = Object.keys(patternLabels) as ProductPattern[];
const FITS = Object.keys(fitLabels) as ProductFit[];
const FORMALITIES = [1, 2, 3, 4, 5];

/** `confirm`: the one tap after a photo was analysed. `edit`: the same form from the item detail, with brand/size/price. */
export type ItemSheetMode = 'confirm' | 'edit';

interface ConfirmItemSheetProps {
  /** The item to show; the sheet is closed while this is `null`. */
  itemId: string | null;
  mode: ItemSheetMode;
  /** Closed without saving (a confirmation stays pending). */
  onClose: () => void;
  /** Saved, kept anyway or deleted: whatever the sheet was opened for is settled. */
  onDone: () => void;
}

export function ConfirmItemSheet({ itemId, mode, onClose, onDone }: ConfirmItemSheetProps) {
  const item = useWardrobeItem(itemId ?? undefined);
  return (
    <BottomSheet
      visible={itemId !== null}
      title={mode === 'confirm' ? tr.wardrobeConfirmTitle : tr.wardrobeEditTitle}
      onClose={onClose}
    >
      {item.data ? (
        mode === 'confirm' && item.data.analysis?.quality.isGarment === false ? (
          <NotGarment item={item.data} onDone={onDone} />
        ) : (
          <ItemForm key={item.data.id} item={item.data} mode={mode} onDone={onDone} />
        )
      ) : (
        <Skeleton height={theme.sizes.itemCutoutHeight} radius={theme.radius.xl} />
      )}
    </BottomSheet>
  );
}

function leaves(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => (node.children.length > 0 ? leaves(node.children) : [node]));
}

function Cutout({ item, color }: { item: WardrobeItem; color: ProductColor }) {
  const uri = item.cutoutUrl ?? item.thumbUrl ?? item.originalUrl;
  return (
    <View style={[styles.cutout, { backgroundColor: colorTint(color) }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.cutoutImage} resizeMode="contain" />
      ) : (
        <Icon name="shirt" size={64} color={theme.colors.borderStrong} strokeWidth={1.2} />
      )}
    </View>
  );
}

/** A photo that does not look like clothing: keep it anyway (the confirmation) or throw it away. */
function NotGarment({ item, onDone }: { item: WardrobeItem; onDone: () => void }) {
  const update = useUpdateItem();
  const archive = useArchiveItem();
  const fail = () => showToast(tr.wardrobeSaveFailed);
  return (
    <>
      <Cutout item={item} color={item.primaryColor} />
      <Text style={styles.notGarmentTitle}>{tr.wardrobeNotGarmentTitle}</Text>
      <Text style={styles.hint}>{tr.wardrobeNotGarmentBody}</Text>
      <Button
        label={tr.wardrobeKeepAnyway}
        onPress={() =>
          update.mutate({ id: item.id, patch: {} }, { onSuccess: onDone, onError: fail })
        }
        loading={update.isPending}
        testID="item-keep-anyway"
      />
      <Button
        label={tr.wardrobeDelete}
        variant="secondary"
        onPress={() => archive.mutate(item.id, { onSuccess: onDone, onError: fail })}
        loading={archive.isPending}
        testID="item-delete"
      />
    </>
  );
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function ItemForm({
  item,
  mode,
  onDone,
}: {
  item: WardrobeItem;
  mode: ItemSheetMode;
  onDone: () => void;
}) {
  const categories = useCategories();
  const update = useUpdateItem();
  const [categorySlug, setCategorySlug] = useState<string | null>(item.category?.slug ?? null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [color, setColor] = useState<ProductColor>(item.primaryColor);
  const [detailsOpen, setDetailsOpen] = useState(mode === 'edit');
  const [pattern, setPattern] = useState<ProductPattern>(item.pattern);
  const [fit, setFit] = useState<ProductFit>(item.fit);
  const [formality, setFormality] = useState(toNumber(item.formality));
  const [seasons, setSeasons] = useState<string[]>(item.seasons);
  const [name, setName] = useState(item.name ?? '');
  const [brand, setBrand] = useState<BrandRef | null>(item.brand);
  const [brandQuery, setBrandQuery] = useState('');
  const [size, setSize] = useState(item.size ?? '');
  const [price, setPrice] = useState(
    item.purchasePrice === null ? '' : String(item.purchasePrice).replace('.', ','),
  );
  const [priceError, setPriceError] = useState<string | undefined>();
  const brandResults = useBrandSearch(brand ? '' : brandQuery);

  const leafList = useMemo(() => leaves(categories.data ?? []), [categories.data]);
  const categoryName = (slug: string) =>
    leafList.find((leaf) => leaf.slug === slug)?.name ?? slug.split('/').pop() ?? slug;
  // The photo's own guesses first (best one first), then what the item already has; "Diğer" opens the whole list.
  const guessed = item.analysis?.categoryCandidates.map((candidate) => candidate.slug) ?? [];
  const suggested = [...new Set([...guessed, ...(item.category ? [item.category.slug] : [])])];
  const categoryChoices =
    showAllCategories || suggested.length === 0 ? leafList.map((leaf) => leaf.slug) : suggested;
  const hint = warningHint([...item.warnings, ...(item.analysis?.quality.warnings ?? [])]);
  const needsPick = categorySlug === null;

  const save = () => {
    const patch: Partial<UpdateWardrobeItemRequest> = {};
    const clear: string[] = [];
    if (categorySlug && categorySlug !== item.category?.slug) patch.categorySlug = categorySlug;
    if (color !== item.primaryColor) patch.primaryColor = color;
    if (pattern !== item.pattern) patch.pattern = pattern;
    if (fit !== item.fit) patch.fit = fit;
    if (formality !== toNumber(item.formality)) patch.formality = formality;
    if (seasons.length > 0 && !sameSet(seasons, item.seasons)) patch.seasons = seasons;
    const trimmedName = name.trim();
    if (trimmedName !== (item.name ?? '')) {
      if (trimmedName) patch.name = trimmedName;
      else clear.push('name');
    }
    if (brand?.id !== item.brand?.id) {
      if (brand) patch.brandId = brand.id;
      else clear.push('brandId');
    }
    const trimmedSize = size.trim();
    if (trimmedSize !== (item.size ?? '')) {
      if (trimmedSize) patch.size = trimmedSize;
      else clear.push('size');
    }
    const priceText = price.trim().replace(',', '.');
    const parsedPrice = priceText === '' ? null : Number(priceText);
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setPriceError(tr.wardrobePriceInvalid);
      return;
    }
    setPriceError(undefined);
    if (parsedPrice !== (item.purchasePrice === null ? null : toNumber(item.purchasePrice))) {
      if (parsedPrice === null) clear.push('purchasePrice');
      else patch.purchasePrice = parsedPrice;
    }
    if (clear.length > 0) patch.clear = clear;
    update.mutate(
      { id: item.id, patch },
      { onSuccess: onDone, onError: () => showToast(tr.wardrobeSaveFailed) },
    );
  };

  return (
    <>
      <Cutout item={item} color={color} />
      {hint ? (
        <View style={styles.hintRow} testID="item-warning">
          <Icon name="info" size={16} color={theme.colors.inkMuted} />
          <Text style={styles.hint}>{hint}</Text>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.label}>
          {item.needsCategory && needsPick ? tr.wardrobeCategoryAsk : tr.wardrobeCategoryLabel}
        </Text>
        <View style={styles.chips}>
          {categoryChoices.map((slug) => (
            <Chip
              key={slug}
              label={categoryName(slug)}
              selected={categorySlug === slug}
              onPress={() => setCategorySlug(slug)}
              testID={`item-category-${slug}`}
            />
          ))}
          {!showAllCategories && suggested.length > 0 ? (
            <Chip
              label={tr.wardrobeCategoryOther}
              onPress={() => setShowAllCategories(true)}
              testID="item-category-other"
            />
          ) : null}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>{tr.wardrobeColorLabel}</Text>
        <View style={styles.swatches}>
          {COLORS.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={colorLabels[value]}
              accessibilityState={{ selected: color === value }}
              hitSlop={theme.spacing.xs}
              onPress={() => setColor(value)}
              style={[
                styles.swatch,
                { backgroundColor: theme.colorNames[value] },
                color === value && styles.swatchSelected,
              ]}
              testID={`item-color-${value}`}
            />
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        onPress={() => setDetailsOpen((open) => !open)}
        style={styles.detailsToggle}
        testID="item-details-toggle"
      >
        <Text style={styles.label}>{tr.wardrobeDetails}</Text>
        <Icon name={detailsOpen ? 'minus' : 'plus'} size={18} />
      </Pressable>

      {detailsOpen ? (
        <>
          <ChipRow label={tr.wardrobePatternLabel}>
            {PATTERNS.map((value) => (
              <Chip
                key={value}
                label={patternLabels[value]}
                selected={pattern === value}
                onPress={() => setPattern(value)}
                testID={`item-pattern-${value}`}
              />
            ))}
          </ChipRow>
          <ChipRow label={tr.wardrobeFitLabel}>
            {FITS.map((value) => (
              <Chip
                key={value}
                label={fitLabels[value]}
                selected={fit === value}
                onPress={() => setFit(value)}
                testID={`item-fit-${value}`}
              />
            ))}
          </ChipRow>
          <ChipRow label={tr.wardrobeFormalityLabel}>
            {FORMALITIES.map((value) => (
              <Chip
                key={value}
                label={FORMALITY_LABELS[value] ?? String(value)}
                selected={formality === value}
                onPress={() => setFormality(value)}
                testID={`item-formality-${value}`}
              />
            ))}
          </ChipRow>
          <ChipRow label={tr.wardrobeSeasonsLabel}>
            {SEASONS.map((value: Season) => (
              <Chip
                key={value}
                label={seasonLabels[value]}
                selected={seasons.includes(value)}
                onPress={() =>
                  setSeasons((current) =>
                    current.includes(value)
                      ? current.filter((season) => season !== value)
                      : [...current, value],
                  )
                }
                testID={`item-season-${value}`}
              />
            ))}
          </ChipRow>
        </>
      ) : null}

      <TextField
        label={tr.wardrobeNameLabel}
        value={name}
        onChangeText={setName}
        placeholder={tr.wardrobeNamePlaceholder}
        maxLength={80}
        testID="item-name"
      />

      {mode === 'edit' ? (
        <>
          {brand ? (
            <ChipRow label={tr.wardrobeBrandLabel}>
              <Chip
                label={brand.name}
                selected
                onPress={() => setBrand(null)}
                testID="item-brand"
              />
            </ChipRow>
          ) : (
            <View style={styles.block}>
              <TextField
                label={tr.wardrobeBrandLabel}
                value={brandQuery}
                onChangeText={setBrandQuery}
                placeholder={tr.wardrobeBrandSearch}
                autoCorrect={false}
                testID="item-brand-search"
              />
              {brandQuery.trim() && brandResults.data
                ? brandResults.data.map((result) => (
                    <Pressable
                      key={result.id}
                      accessibilityRole="button"
                      onPress={() =>
                        setBrand({ id: result.id, name: result.name, slug: result.slug })
                      }
                      style={styles.brandRow}
                      testID={`item-brand-${result.slug}`}
                    >
                      <Text style={styles.brandName}>{result.name}</Text>
                    </Pressable>
                  ))
                : null}
            </View>
          )}
          <TextField
            label={tr.wardrobeSizeLabel}
            value={size}
            onChangeText={setSize}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            testID="item-size"
          />
          <TextField
            label={tr.wardrobePriceLabel}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            error={priceError}
            testID="item-price"
          />
        </>
      ) : null}

      <Button
        label={tr.wardrobeSave}
        onPress={save}
        loading={update.isPending}
        disabled={needsPick}
        testID="item-save"
      />
    </>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  cutout: {
    height: theme.sizes.itemCutoutHeight,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cutoutImage: {
    width: '100%',
    height: '100%',
  },
  notGarmentTitle: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  hint: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    flexShrink: 1,
  },
  block: {
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.typography.captionMedium,
    color: theme.colors.inkSoft,
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
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: theme.colors.ink,
  },
  detailsToggle: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  brandName: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
});
