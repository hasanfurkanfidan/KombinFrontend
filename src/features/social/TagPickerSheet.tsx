import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { listProducts } from '@/api/endpoints/catalog';
import type { WardrobeItemSummary } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { colorLabels } from '@/features/catalog/filters';
import { useWardrobeItems } from '@/features/wardrobe/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { formatTry, toNumber } from '@/utils/money';

import { MAX_LABEL } from './labels';
import type { DotChoice, DraftDot } from './tagDraft';

export type PickKind = DotChoice['kind'];

interface TagPickerSheetProps {
  /** The dot being decided and the way the author chose to name it; `null` closes the sheet. */
  target: { dot: DraftDot; kind: PickKind } | null;
  onClose: () => void;
  onChoose: (key: string, choice: DotChoice) => void;
}

/**
 * Names one dot: a piece of the author's wardrobe ("dolaptan"), a catalog product ("üründen", pre-filtered by the
 * proposal's category and colour, with a way to widen it) or "bilinmiyor" with an optional label of up to 60 characters.
 */
export function TagPickerSheet({ target, onClose, onChoose }: TagPickerSheetProps) {
  const title =
    target?.kind === 'Wardrobe'
      ? tr.tagKindWardrobe
      : target?.kind === 'Product'
        ? tr.tagKindProduct
        : tr.tagKindUnknown;
  return (
    <BottomSheet visible={target !== null} title={target ? title : undefined} onClose={onClose}>
      {target?.kind === 'Wardrobe' ? (
        <WardrobePicker dot={target.dot} onChoose={onChoose} />
      ) : target?.kind === 'Product' ? (
        <ProductPicker dot={target.dot} onChoose={onChoose} />
      ) : target?.kind === 'Unknown' ? (
        <UnknownPicker dot={target.dot} onChoose={onChoose} />
      ) : null}
    </BottomSheet>
  );
}

function WardrobePicker({
  dot,
  onChoose,
}: {
  dot: DraftDot;
  onChoose: (key: string, choice: DotChoice) => void;
}) {
  const [narrow, setNarrow] = useState(Boolean(dot.categorySlug));
  const items = useWardrobeItems(narrow && dot.categorySlug ? { category: dot.categorySlug } : {});
  const ready = (items.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) => item.status === 'Ready',
  );

  return (
    <>
      {dot.categorySlug ? <NarrowToggle narrow={narrow} onChange={setNarrow} /> : null}
      {items.isError ? <Text style={styles.empty}>{tr.tagPickLoadFailed}</Text> : null}
      {!items.isPending && !items.isError && ready.length === 0 ? (
        <Text style={styles.empty}>{tr.tagPickWardrobeEmpty}</Text>
      ) : null}
      {ready.map((item) => (
        <PickRow
          key={item.id}
          testID={`pick-wardrobe-${item.id}`}
          title={wardrobeName(item)}
          caption={colorLabels[item.primaryColor]}
          imageUrl={item.thumbUrl}
          tint={colorTint(item.primaryColor)}
          onPress={() =>
            onChoose(dot.key, {
              kind: 'Wardrobe',
              wardrobeItemId: item.id,
              name: wardrobeName(item),
            })
          }
        />
      ))}
    </>
  );
}

function wardrobeName(item: WardrobeItemSummary): string {
  return item.name ?? item.categorySlug?.split('/').pop() ?? tr.tagKindWardrobe;
}

function ProductPicker({
  dot,
  onChoose,
}: {
  dot: DraftDot;
  onChoose: (key: string, choice: DotChoice) => void;
}) {
  const hasFilter = Boolean(dot.categorySlug ?? dot.color);
  const [narrow, setNarrow] = useState(hasFilter);
  const categorySlug = narrow ? (dot.categorySlug ?? undefined) : undefined;
  const color = narrow ? (dot.color ?? undefined) : undefined;
  const products = useQuery({
    // Not under the `social` prefix: those caches are walked looking for posts.
    queryKey: ['catalog', 'tag-products', categorySlug ?? null, color ?? null] as const,
    queryFn: ({ signal }) =>
      listProducts({ CategorySlug: categorySlug, Color: color, Page: 1, PageSize: 20 }, signal),
    select: (data) => data.items,
    staleTime: 60_000,
  });

  return (
    <>
      {hasFilter ? <NarrowToggle narrow={narrow} onChange={setNarrow} /> : null}
      {products.isError ? <Text style={styles.empty}>{tr.tagPickLoadFailed}</Text> : null}
      {products.data && products.data.length === 0 ? (
        <Text style={styles.empty}>{tr.tagPickProductEmpty}</Text>
      ) : null}
      {(products.data ?? []).map((product) => (
        <PickRow
          key={product.id}
          testID={`pick-product-${product.id}`}
          title={product.name}
          caption={`${product.brand.name} · ${formatTry(toNumber(product.lowestPrice))}`}
          imageUrl={product.primaryImageUrl}
          tint={theme.colors.surfaceAlt}
          onPress={() =>
            onChoose(dot.key, { kind: 'Product', productId: product.id, name: product.name })
          }
        />
      ))}
    </>
  );
}

function UnknownPicker({
  dot,
  onChoose,
}: {
  dot: DraftDot;
  onChoose: (key: string, choice: DotChoice) => void;
}) {
  const [label, setLabel] = useState(dot.choice?.kind === 'Unknown' ? dot.choice.label : '');
  return (
    <>
      <Text style={styles.body}>{tr.tagPickUnknownBody}</Text>
      <TextField
        label={tr.tagPickUnknownLabel}
        value={label}
        onChangeText={setLabel}
        maxLength={MAX_LABEL}
        testID="unknown-label"
      />
      <Button
        label={tr.tagPickUnknownConfirm}
        onPress={() => onChoose(dot.key, { kind: 'Unknown', label })}
        testID="unknown-confirm"
      />
    </>
  );
}

/** "Bu kategori" / "Tümü": the proposal's category and colour narrow the list, and the author can widen it. */
function NarrowToggle({
  narrow,
  onChange,
}: {
  narrow: boolean;
  onChange: (narrow: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Chip label={tr.tagPickNarrow} selected={narrow} onPress={() => onChange(true)} />
      <Chip label={tr.filterAll} selected={!narrow} onPress={() => onChange(false)} />
    </View>
  );
}

function PickRow({
  title,
  caption,
  imageUrl,
  tint,
  onPress,
  testID,
}: {
  title: string;
  caption: string;
  imageUrl: string | null;
  tint: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row} testID={testID}>
      <View style={[styles.thumb, { backgroundColor: tint }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumbImage} resizeMode="contain" />
        ) : (
          <Icon name="shirt" size={22} color={theme.colors.borderStrong} strokeWidth={1.4} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rowCaption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  empty: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
  row: {
    minHeight: theme.sizes.pickerThumb,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  thumb: {
    width: theme.sizes.pickerThumb,
    height: theme.sizes.pickerThumb,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
    margin: theme.spacing.xs,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  rowCaption: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
});
