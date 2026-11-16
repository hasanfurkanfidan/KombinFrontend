import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LensRegion, LensResult } from '@/api/models';
import { AppImage } from '@/components/AppImage';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { levelLabel } from './labels';
import { announce, lines } from '@/utils/a11y';

interface RegionResultsProps {
  region: LensRegion;
  /** The number of its outline on the photo. */
  number: number;
  title: string;
  onOpenProduct: (result: LensResult, position: number) => void;
  onOpenItem: (itemId: string) => void;
  /** The empty rail carries the screen's one "Dolabıma ekle" (the bottom bar hides it then). */
  addButton: { label: string; onPress: () => void; loading: boolean; disabled: boolean };
}

/** Under the photo, for the selected region: "Dolabında benzeri var", then the rail of products (or the honest empty line). */
export function RegionResults({
  region,
  number,
  title,
  onOpenProduct,
  onOpenItem,
  addButton,
}: RegionResultsProps) {
  const owned = region.wardrobeMatches ?? [];
  const count = region.results.length;

  // The rail appears under the photo, away from where the finger is: say what it holds.
  useEffect(() => {
    if (count > 0) {
      announce(`${title}. ${tr.lensResultCount(count)}`);
    }
  }, [title, count]);

  return (
    <View style={styles.root} testID="lens-region-results">
      <View style={styles.heading}>
        <View style={styles.number}>
          <Text style={styles.numberText}>{number}</Text>
        </View>
        <View style={styles.headingText}>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={lines(1)}>
            {title}
          </Text>
          {count > 0 ? <Text style={styles.subtitle}>{tr.lensResultCount(count)}</Text> : null}
        </View>
      </View>

      {owned.length > 0 ? (
        <View style={styles.owned} testID="lens-wardrobe-matches">
          <Text style={styles.ownedTitle}>{tr.lensWardrobeMatches}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ownedRow}
          >
            {owned.map(({ item }) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.name ?? tr.lensWardrobeMatches}
                onPress={() => onOpenItem(item.id)}
                style={styles.ownedThumb}
                testID={`lens-owned-${item.id}`}
              >
                {item.thumbUrl ? (
                  <AppImage
                    uri={item.thumbUrl}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <Icon name="shirt" size={24} color={theme.colors.control} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {count === 0 ? (
        <View style={styles.empty} testID="lens-empty-rail">
          <Text style={styles.emptyText}>{tr.lensEmptyRail}</Text>
          <Button
            label={addButton.label}
            onPress={addButton.onPress}
            loading={addButton.loading}
            disabled={addButton.disabled}
            testID="lens-add"
          />
        </View>
      ) : (
        <FlatList
          horizontal
          data={region.results}
          keyExtractor={(result) => result.product.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item, index }) => (
            <ResultCard result={item} onPress={() => onOpenProduct(item, index)} />
          )}
          testID="lens-rail"
        />
      )}
    </View>
  );
}

function ResultCard({ result, onPress }: { result: LensResult; onPress: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { product, offer } = result;
  const price = offer ? toNumber(offer.price) : toNumber(product.lowestPrice);
  const seller = offer ? offer.seller?.name : product.cheapestSeller?.name;
  const image = imageFailed ? null : product.primaryImageUrl;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.card}
      testID={`lens-result-${product.id}`}
    >
      <View style={styles.cardImage}>
        {image ? (
          <AppImage
            uri={image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon name="shirt" size={32} color={theme.colors.control} />
        )}
        <View style={[styles.level, result.level === 'close' && styles.levelClose]}>
          <Text style={[styles.levelText, result.level === 'close' && styles.levelTextClose]}>
            {levelLabel(result.level)}
          </Text>
        </View>
      </View>
      <Text style={styles.cardBrand} numberOfLines={lines(1)}>
        {product.brand.name}
      </Text>
      <Text style={styles.cardName} numberOfLines={lines(2)}>
        {product.name}
      </Text>
      <Text style={styles.cardPrice}>{formatTry(price)}</Text>
      <Text style={styles.cardSeller} numberOfLines={lines(1)}>
        {offer === null ? tr.lensNotForSale : seller ? tr.lensCheapestAt(seller) : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.spacing.lg,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
  },
  number: {
    width: theme.sizes.lensRegionBadge,
    height: theme.sizes.lensRegionBadge,
    borderRadius: theme.sizes.lensRegionBadge / 2,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    ...theme.typography.captionStrong,
    color: theme.colors.onPrimary,
  },
  headingText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.subhead,
    color: theme.colors.ink,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  owned: {
    gap: theme.spacing.sm,
  },
  ownedTitle: {
    ...theme.typography.label,
    color: theme.colors.ink,
    paddingHorizontal: theme.screenPaddingX,
  },
  ownedRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.screenPaddingX,
  },
  ownedThumb: {
    width: theme.sizes.lensWardrobeThumb,
    height: theme.sizes.lensWardrobeThumb,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  empty: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.screenPaddingX,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  rail: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.screenPaddingX,
  },
  card: {
    width: theme.sizes.lensRailCardWidth,
    gap: 2,
  },
  cardImage: {
    height: theme.sizes.lensRailImageHeight,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  level: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    borderRadius: theme.radius.tag,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  levelClose: {
    borderColor: theme.colors.ink,
  },
  levelText: {
    ...theme.typography.captionMedium,
    color: theme.colors.ink2,
  },
  levelTextClose: {
    fontFamily: theme.fontFamilies.semibold,
    color: theme.colors.ink,
  },
  cardBrand: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  cardName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  cardPrice: {
    ...theme.typography.price,
    color: theme.colors.ink,
  },
  cardSeller: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
});
