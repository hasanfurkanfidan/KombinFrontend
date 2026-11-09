import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { LensRegion } from '@/api/models';
import { Shimmer } from '@/components/Shimmer';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { regionTitle } from './labels';

interface LensPhotoViewProps {
  uri: string;
  /** Pixel size of the photo; unknown (a picked photo without a size) draws it square. */
  width?: number;
  height?: number;
  /** "Parçalar aranıyor…": a quiet light band over the photo while the search runs. */
  scanning?: boolean;
  /** Regions to outline (results state); not drawn for a whole-photo search. */
  regions?: readonly LensRegion[];
  wholePhoto?: boolean;
  selected?: number;
  onSelect?: (position: number) => void;
}

/** Full-width photo (at most `lensPhotoMaxRatio` of the window high) with each region as a numbered, tappable outline. */
export function LensPhotoView({
  uri,
  width,
  height,
  scanning = false,
  regions = [],
  wholePhoto = false,
  selected = 0,
  onSelect,
}: LensPhotoViewProps) {
  const window = useWindowDimensions();
  const aspect = width && height ? width / height : 1;
  const maxHeight = window.height * theme.sizes.lensPhotoMaxRatio;
  let displayWidth = window.width;
  let displayHeight = displayWidth / aspect;
  if (displayHeight > maxHeight) {
    displayHeight = maxHeight;
    displayWidth = displayHeight * aspect;
  }

  // Larger outlines first, so a small region inside a big one stays on top and tappable. Numbers follow the
  // backend's order (regions with results first), so "1" is the one selected at the start.
  const drawn = wholePhoto
    ? []
    : regions
        .map((region, position) => ({ region, position }))
        .sort((a, b) => area(b.region) - area(a.region));

  return (
    <View style={styles.frame}>
      <View style={{ width: displayWidth, height: displayHeight }}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          testID="lens-photo"
        />
        {drawn.map(({ region, position }) => {
          const isSelected = position === selected;
          return (
            <Pressable
              key={position}
              accessibilityRole="button"
              accessibilityLabel={tr.lensRegionLabel(position + 1, regionTitle(region, false))}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect?.(position)}
              testID={`lens-region-${position}`}
              style={[
                styles.region,
                isSelected && styles.regionSelected,
                {
                  left: toNumber(region.box.x) * displayWidth,
                  top: toNumber(region.box.y) * displayHeight,
                  width: toNumber(region.box.w) * displayWidth,
                  height: toNumber(region.box.h) * displayHeight,
                },
              ]}
            >
              <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                  {position + 1}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {scanning ? (
          <View style={styles.scanning} testID="lens-scanning">
            <Shimmer />
            <View style={styles.scanningPill}>
              <Text style={styles.scanningText}>{tr.lensScanning}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function area(region: LensRegion): number {
  return toNumber(region.box.w) * toNumber(region.box.h);
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: theme.colors.ink,
  },
  region: {
    position: 'absolute',
    borderRadius: theme.radius.md,
    borderWidth: theme.sizes.lensRegionBorder,
    borderColor: theme.colors.onInk,
  },
  regionSelected: {
    borderWidth: theme.sizes.lensRegionBorderSelected,
  },
  badge: {
    position: 'absolute',
    // Inside the outline: a region on the photo's edge would push a straddling badge off screen.
    top: theme.spacing.xs,
    left: theme.spacing.xs,
    width: theme.sizes.lensRegionBadge,
    height: theme.sizes.lensRegionBadge,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    borderWidth: 2,
    borderColor: theme.colors.onInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: {
    backgroundColor: theme.colors.onInk,
    borderColor: theme.colors.ink,
  },
  badgeText: {
    ...theme.typography.captionMedium,
    color: theme.colors.onInk,
  },
  badgeTextSelected: {
    color: theme.colors.ink,
  },
  scanning: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanningPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  scanningText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
});
