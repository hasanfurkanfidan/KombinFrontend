import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { WardrobeItem } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { colorLabels } from '@/features/catalog/filters';
import { productHref } from '@/features/catalog/productLink';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { formatShortDate } from '@/utils/dates';
import { formatTry, toNumber } from '@/utils/money';

import { ConfirmItemSheet } from './ConfirmItemSheet';
import {
  useArchiveItem,
  useCategoryName,
  useUndoWear,
  useWardrobeItem,
  useWearItem,
} from './hooks';
import { FORMALITY_LABELS, fitLabels, patternLabels, seasonLabels, type Season } from './labels';

export function WardrobeItemScreen({ id }: { id: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const item = useWardrobeItem(id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const archive = useArchiveItem();
  const wear = useWearItem();
  const undo = useUndoWear();

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/wardrobe'));

  const confirmArchive = () => {
    setMenuOpen(false);
    Alert.alert(tr.wardrobeArchiveConfirmTitle, tr.wardrobeArchiveConfirmBody, [
      { text: tr.close, style: 'cancel' },
      {
        text: tr.wardrobeArchive,
        style: 'destructive',
        onPress: () =>
          archive.mutate(id, {
            onSuccess: () => {
              showToast(tr.wardrobeArchived);
              goBack();
            },
            onError: () => showToast(tr.wardrobeActionFailed),
          }),
      },
    ]);
  };

  const wearToday = () =>
    wear.mutate(id, {
      onSuccess: (result) => {
        const wornOn = result.wornOn;
        showToast(
          tr.wardrobeWornTodayDone,
          wornOn
            ? {
                label: tr.wardrobeUndo,
                onPress: () =>
                  undo.mutate(
                    { id, wornOn },
                    { onError: () => showToast(tr.wardrobeActionFailed) },
                  ),
              }
            : undefined,
        );
      },
      onError: () => showToast(tr.wardrobeActionFailed),
    });

  return (
    <View style={styles.root}>
      {item.isPending ? (
        <Skeleton height={theme.sizes.itemCutoutHeight} radius={0} />
      ) : item.isError ? (
        <View style={[styles.errorWrap, { paddingTop: insets.top + theme.sizes.touch }]}>
          {item.error instanceof ApiError && item.error.status === 404 ? (
            <ErrorState title={tr.wardrobeItemNotFound} />
          ) : (
            <ErrorState onRetry={() => void item.refetch()} />
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xxxl }}
        >
          <ItemBody
            item={item.data}
            onWear={wearToday}
            wearing={wear.isPending}
            onMakeOutfit={() => router.push(`/outfits/how-to-wear?wardrobeItemId=${id}`)}
            onOpenProduct={(productId) => router.push(productHref(productId, 'direct'))}
          />
        </ScrollView>
      )}

      <View style={[styles.topBar, { top: insets.top + theme.spacing.sm }]}>
        <IconButton icon="arrowLeft" label={tr.back} onPress={goBack} testID="item-back" />
        {item.data ? (
          <IconButton
            icon="more"
            label={tr.wardrobeMenu}
            onPress={() => setMenuOpen(true)}
            testID="item-menu"
          />
        ) : null}
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Pressable
          accessibilityRole="button"
          style={styles.menuRow}
          onPress={() => {
            setMenuOpen(false);
            setEditOpen(true);
          }}
          testID="item-menu-edit"
        >
          <Text style={styles.menuLabel}>{tr.wardrobeEdit}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.menuRow}
          onPress={confirmArchive}
          testID="item-menu-archive"
        >
          <Text style={[styles.menuLabel, styles.menuDanger]}>{tr.wardrobeArchive}</Text>
        </Pressable>
      </BottomSheet>

      <ConfirmItemSheet
        itemId={editOpen ? id : null}
        mode="edit"
        onClose={() => setEditOpen(false)}
        onDone={() => setEditOpen(false)}
      />
    </View>
  );
}

function ItemBody({
  item,
  onWear,
  wearing,
  onMakeOutfit,
  onOpenProduct,
}: {
  item: WardrobeItem;
  onWear: () => void;
  wearing: boolean;
  onMakeOutfit: () => void;
  onOpenProduct: (productId: string) => void;
}) {
  const category = useCategoryName(item.category?.slug);
  const uri = item.cutoutUrl ?? item.thumbUrl ?? item.originalUrl;
  const wearCount = toNumber(item.wearCount);
  const seasons = item.seasons.map((season) => seasonLabels[season as Season] ?? season).join(', ');
  const rows: [string, string][] = [
    [tr.wardrobeCategoryLabel, category ?? '—'],
    [tr.wardrobeColorLabel, colorLabels[item.primaryColor]],
    [tr.wardrobePatternLabel, patternLabels[item.pattern]],
    [tr.wardrobeFitLabel, fitLabels[item.fit]],
    [tr.wardrobeFormalityLabel, FORMALITY_LABELS[toNumber(item.formality)] ?? '—'],
    ...(seasons ? [[tr.wardrobeSeasonsLabel, seasons] as [string, string]] : []),
    ...(item.brand ? [[tr.wardrobeBrandLabel, item.brand.name] as [string, string]] : []),
    ...(item.size ? [[tr.wardrobeSizeLabel, item.size] as [string, string]] : []),
    ...(item.purchasePrice !== null
      ? [[tr.wardrobePriceLabel, formatTry(item.purchasePrice)] as [string, string]]
      : []),
  ];

  return (
    <>
      <View style={[styles.cutout, { backgroundColor: colorTint(item.primaryColor) }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.cutoutImage} resizeMode="contain" />
        ) : (
          <Icon name="shirt" size={72} color={theme.colors.borderStrong} strokeWidth={1.2} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} testID="item-title">
          {item.name ?? category ?? tr.wardrobeItemUnnamed}
        </Text>
        <View style={styles.attributes}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.attributeRow}>
              <Text style={styles.attributeLabel}>{label}</Text>
              <Text style={styles.attributeValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.history} testID="item-wear-history">
          <Text style={styles.historyCount}>{tr.wardrobeWearCount(wearCount)}</Text>
          {item.lastWornAt ? (
            <Text style={styles.historyLast}>
              {tr.wardrobeLastWorn(formatShortDate(item.lastWornAt))}
            </Text>
          ) : null}
        </View>

        <Button
          label={tr.wardrobeWornToday}
          onPress={onWear}
          loading={wearing}
          testID="item-wear"
        />
        <Button
          label={tr.wardrobeMakeOutfit}
          variant="secondary"
          onPress={onMakeOutfit}
          testID="item-make-outfit"
        />
        {item.fromCatalog && item.productId ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => onOpenProduct(item.productId as string)}
            style={styles.productLink}
            testID="item-product-link"
          >
            <Text style={styles.productLinkText}>{tr.wardrobeFromCatalog}</Text>
            <Icon name="arrowUpRight" size={16} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: theme.screenPaddingX,
    right: theme.screenPaddingX,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  cutout: {
    height: theme.sizes.detailImageHeight + theme.spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutoutImage: {
    width: '80%',
    height: '80%',
  },
  body: {
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  name: {
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
  attributes: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  attributeRow: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  attributeLabel: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  attributeValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    flexShrink: 1,
    textAlign: 'right',
  },
  history: {
    gap: theme.spacing.xs,
  },
  historyCount: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  historyLast: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  productLink: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  productLinkText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
    textDecorationLine: 'underline',
  },
  menuRow: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  menuLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  menuDanger: {
    color: theme.colors.warning,
  },
});
