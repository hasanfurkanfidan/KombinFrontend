import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type { WardrobeItem, WardrobePairings } from '@/api/models';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { productHref } from '@/features/catalog/productLink';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { formatShortDate } from '@/utils/dates';
import { toNumber } from '@/utils/money';

import { ConfirmItemSheet } from './ConfirmItemSheet';
import {
  useArchiveItem,
  useCategoryName,
  useItemPairings,
  useUndoWear,
  useWardrobeItem,
  useWearItem,
} from './hooks';
import { CompanionRows, UnlockCard, companionTotal } from './PairingsSection';

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

  const wearToday = () => {
    setMenuOpen(false);
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
  };

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
            onOpenItem={(itemId) => router.push(`/wardrobe/${itemId}`)}
            onDetails={() => setEditOpen(true)}
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
        {item.data ? (
          <View style={styles.wearBlock} testID="item-wear-history">
            <Pressable
              accessibilityRole="button"
              style={styles.menuRow}
              onPress={wearToday}
              disabled={wear.isPending}
              testID="item-menu-wear"
            >
              <Text style={styles.menuLabel}>{tr.wardrobeWornToday}</Text>
            </Pressable>
            <Text style={styles.historyCount}>
              {tr.wardrobeWearCount(toNumber(item.data.wearCount))}
            </Text>
            {item.data.lastWornAt ? (
              <Text style={styles.historyLast}>
                {tr.wardrobeLastWorn(formatShortDate(item.data.lastWornAt))}
              </Text>
            ) : null}
          </View>
        ) : null}
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
  onOpenItem,
  onDetails,
  onMakeOutfit,
  onOpenProduct,
}: {
  item: WardrobeItem;
  onOpenItem: (id: string) => void;
  onDetails: () => void;
  onMakeOutfit: () => void;
  onOpenProduct: (productId: string) => void;
}) {
  const { height } = useWindowDimensions();
  const category = useCategoryName(item.category?.slug);
  const pairings = useItemPairings(item.id);
  const uri = item.cutoutUrl ?? item.thumbUrl ?? item.originalUrl;

  // One `wardrobe_pairings_view` per opened item, once its answer is on screen.
  const reported = useRef<string | null>(null);
  const answer = pairings.data;
  useEffect(() => {
    if (answer && reported.current !== item.id) {
      reported.current = item.id;
      track('wardrobe_pairings_view', {
        companionTotal: companionTotal(answer.companions),
        hasUnlock: answer.unlock !== null,
      });
    }
  }, [answer, item.id]);

  return (
    <>
      <View
        style={[
          styles.cutout,
          {
            height: height * theme.sizes.itemCutoutRatio,
            backgroundColor: colorTint(item.primaryColor),
          },
        ]}
      >
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

        <Text style={styles.sectionTitle}>{tr.pairingsTitle}</Text>
        <PairingsBody
          pairings={pairings}
          onOpenItem={onOpenItem}
          onMakeOutfit={onMakeOutfit}
          onOpenProduct={onOpenProduct}
        />

        <Pressable
          accessibilityRole="button"
          onPress={onDetails}
          style={styles.detailsRow}
          testID="item-details"
        >
          <Text style={styles.detailsLabel}>{tr.wardrobeDetails}</Text>
          <Icon name="chevronRight" size={20} color={theme.colors.inkMuted} />
        </Pressable>
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

/** The companion rows, the outfit count with "Kombin yap", and the unlock card; each state of the query has its text. */
function PairingsBody({
  pairings,
  onOpenItem,
  onMakeOutfit,
  onOpenProduct,
}: {
  pairings: ReturnType<typeof useItemPairings>;
  onOpenItem: (id: string) => void;
  onMakeOutfit: () => void;
  onOpenProduct: (productId: string) => void;
}) {
  if (pairings.isPending) {
    return (
      <View style={styles.pairingsSkeleton} testID="pairings-loading">
        <Skeleton height={theme.sizes.pairingTile} radius={theme.radius.xl} />
        <Skeleton height={theme.sizes.pairingTile} radius={theme.radius.xl} />
      </View>
    );
  }
  if (pairings.isError) {
    if (pairings.error instanceof ApiError && pairings.error.status === 404) {
      return <Text style={styles.note}>{tr.pairingsUnavailable}</Text>;
    }
    return (
      <View style={styles.errorBlock}>
        <Text style={styles.note}>{tr.pairingsFailed}</Text>
        <Button label={tr.retry} variant="secondary" onPress={() => void pairings.refetch()} />
      </View>
    );
  }
  const data: WardrobePairings = pairings.data;
  const { unlock } = data;
  return (
    <>
      <CompanionRows slots={data.companions} onOpenItem={onOpenItem} />
      <View style={styles.outfitRow}>
        <Text style={styles.outfitCount} testID="pairing-outfit-count">
          {tr.pairingsOutfitCount(toNumber(data.outfitCount))}
        </Text>
        <Button
          label={tr.wardrobeMakeOutfit}
          variant="secondary"
          onPress={onMakeOutfit}
          style={styles.makeOutfit}
          testID="item-make-outfit"
        />
      </View>
      {unlock ? (
        <UnlockCard
          unlock={unlock}
          onInspect={(productId) => {
            track('wardrobe_unlock_click', {});
            onOpenProduct(productId);
          }}
        />
      ) : null}
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
  sectionTitle: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  pairingsSkeleton: {
    gap: theme.spacing.lg,
  },
  errorBlock: {
    gap: theme.spacing.md,
  },
  note: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  outfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  outfitCount: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
    flexShrink: 1,
  },
  makeOutfit: {
    paddingHorizontal: theme.spacing.xl,
  },
  detailsRow: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  detailsLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  wearBlock: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
