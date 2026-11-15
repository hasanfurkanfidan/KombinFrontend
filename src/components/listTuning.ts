import { Platform } from 'react-native';

/**
 * Virtualisation settings for every list whose rows carry photos (catalog grids, the feed, the wardrobe grid, saved
 * outfits, posts, alerts, notifications). React Native's defaults keep 21 screens' worth of rows mounted (10 above,
 * 10 below), and every mounted photo stays decoded in memory: on a 2-column product grid that is about 120 decoded
 * images. A window of 7 screens keeps scrolling smooth with roughly a third of that. Android also detaches rows
 * that are off screen (`removeClippedSubviews`); on iOS it is left off because it can blank cells while flinging.
 */
export const IMAGE_LIST_TUNING = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 6,
  windowSize: 7,
  removeClippedSubviews: Platform.OS === 'android',
} as const;
