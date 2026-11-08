import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  OutfitSlot,
  PairingCompanion,
  PairingSlot,
  PairingUnlock,
  PairReason,
  WardrobeItemSummary,
} from '@/api/models';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';
import { formatTry, toNumber } from '@/utils/money';

export const slotLabels: Record<OutfitSlot, string> = {
  Top: tr.wardrobeCategoryTop,
  Bottom: tr.wardrobeCategoryBottom,
  Outerwear: tr.wardrobeCategoryOuterwear,
  Shoes: tr.wardrobeCategoryShoes,
  Accessory: tr.wardrobeCategoryAccessories,
};

/** Lowercase, for the middle of a sentence ("Bir ayakkabı ekle"). */
const slotWords: Record<OutfitSlot, string> = {
  Top: tr.pairingsSlotTop,
  Bottom: tr.pairingsSlotBottom,
  Outerwear: tr.pairingsSlotOuterwear,
  Shoes: tr.pairingsSlotShoes,
  Accessory: tr.pairingsSlotAccessory,
};

/** The one-line "why" behind a companion, in words a person would use (no colour-theory terms). */
export const reasonLabels: Record<PairReason, string> = {
  neutral: tr.pairWhyNeutral,
  tonal: tr.pairWhyTonal,
  complementary: tr.pairWhyComplementary,
  analogous: tr.pairWhyAnalogous,
  statement: tr.pairWhyStatement,
};

/** How many pieces the whole answer lists: what `wardrobe_pairings_view` reports. */
export function companionTotal(slots: readonly PairingSlot[]): number {
  return slots.reduce((sum, slot) => sum + toNumber(slot.total), 0);
}

/** "Bununla gidenler": one horizontal row per slot, an empty slot is a dashed tile. */
export function CompanionRows({
  slots,
  onOpenItem,
}: {
  slots: readonly PairingSlot[];
  onOpenItem: (id: string) => void;
}) {
  return (
    <View style={styles.rows} testID="pairing-rows">
      {slots.map((slot) => (
        <View key={slot.slot} style={styles.row} testID={`pairing-row-${slot.slot}`}>
          <Text style={styles.rowTitle}>{slotLabels[slot.slot]}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowContent}
          >
            {slot.items.length === 0 ? (
              <View style={[styles.tile, styles.emptyTile]} testID={`pairing-empty-${slot.slot}`}>
                <Text style={styles.emptyText}>{tr.pairingsEmptySlot}</Text>
              </View>
            ) : (
              slot.items.map((companion) => (
                <CompanionTile key={companion.item.id} companion={companion} onPress={onOpenItem} />
              ))
            )}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function CompanionTile({
  companion,
  onPress,
}: {
  companion: PairingCompanion;
  onPress: (id: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const item: WardrobeItemSummary = companion.item;
  return (
    <View style={styles.companion}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name ?? tr.wardrobeItemUnnamed}
        onPress={() => onPress(item.id)}
        style={[styles.tile, { backgroundColor: colorTint(item.primaryColor) }]}
        testID={`pairing-item-${item.id}`}
      >
        {item.thumbUrl && !imageFailed ? (
          <Image
            source={{ uri: item.thumbUrl }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon name="shirt" size={32} color={theme.colors.borderStrong} strokeWidth={1.4} />
        )}
      </Pressable>
      <Text style={styles.reason} testID={`pairing-reason-${item.id}`}>
        {reasonLabels[companion.reason]}
      </Text>
    </View>
  );
}

/** The black card with the one catalog piece that would pair with the most: the wardrobe side's commercial moment. */
export function UnlockCard({
  unlock,
  onInspect,
}: {
  unlock: PairingUnlock;
  onInspect: (productId: string) => void;
}) {
  return (
    <View style={styles.unlock} testID="pairing-unlock">
      <Text style={styles.unlockTitle}>
        {tr.pairingsUnlockTitle(slotWords[unlock.slot], toNumber(unlock.unlocksEstimate))}
      </Text>
      <View style={styles.unlockBody}>
        <View style={styles.unlockThumb}>
          {unlock.imageUrl ? (
            <Image source={{ uri: unlock.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : null}
        </View>
        <View style={styles.unlockText}>
          <Text style={styles.unlockName} numberOfLines={2}>
            {unlock.name}
          </Text>
          <Text style={styles.unlockMeta} numberOfLines={1}>
            {formatTry(unlock.lowestPrice)} · {unlock.cheapestSeller.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onInspect(unlock.productId)}
          style={styles.unlockButton}
          testID="pairing-unlock-inspect"
        >
          <Text style={styles.unlockButtonText}>{tr.pairingsInspect}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: theme.spacing.xl,
  },
  row: {
    gap: theme.spacing.sm,
  },
  rowTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  rowContent: {
    gap: theme.spacing.md,
  },
  companion: {
    width: theme.sizes.pairingTile,
    gap: theme.spacing.xs,
  },
  tile: {
    width: theme.sizes.pairingTile,
    height: theme.sizes.pairingTile,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyTile: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  reason: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  unlock: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    backgroundColor: theme.colors.ink,
    padding: theme.spacing.xl,
  },
  unlockTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
  },
  unlockBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  unlockThumb: {
    width: theme.sizes.thumbWidth,
    height: theme.sizes.thumbHeight,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  unlockText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  unlockName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.onInk,
  },
  unlockMeta: {
    ...theme.typography.caption,
    color: theme.colors.borderStrong,
  },
  unlockButton: {
    minHeight: theme.sizes.touch,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
});
