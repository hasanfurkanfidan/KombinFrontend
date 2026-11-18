import { Image } from 'expo-image';
import { type ImageStyle, type StyleProp } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { imageCacheKey } from '@/utils/imageCacheKey';

export interface AppImageProps {
  /** A remote URL or a local `file://` URI. */
  uri: string;
  /** Sized by its style (fill a box, or explicit width/height): an image never decides its own size. */
  style: StyleProp<ImageStyle>;
  /** `cover` crops to fill the box, `contain` shows the whole picture; the same names as before and as `expo-image`'s. */
  contentFit?: 'cover' | 'contain';
  onError?: () => void;
  /**
   * The picture shows a person's body or an unprocessed photo (a try-on render, a post's photo, a Lens photo, an
   * original): it is kept in memory only and never written to the disk cache, so nothing of it outlives the launch.
   */
  private?: boolean;
  /** The picture has been decoded and drawn (the league times a vote from the moment both figures are on screen). */
  onLoad?: () => void;
  /**
   * What the picture shows, when it carries information a screen reader user would miss. Without it the image is
   * decorative: hidden from the tree (the name and price beside it already say what it is).
   */
  accessibilityLabel?: string;
  accessibilityIgnoresInvertColors?: boolean;
  testID?: string;
}

/** The fade-in of a picture that has just arrived; none under reduced motion. */
export const IMAGE_TRANSITION_MS = 120;

/**
 * The one image component of the app, over `expo-image`: every remote picture is downloaded once and then comes from
 * the memory or disk cache (`memory-disk`, kept across launches, emptied at sign-out: see `clearImageCache`). The cache
 * policy lives here and nowhere else. A `private` picture (see the prop) uses `memory` instead.
 *
 * - `source.cacheKey` (`imageCacheKey`): a presigned link keeps one cache entry whatever its signature says.
 * - `recyclingKey`: a list cell that is reused for another picture drops the old one at once instead of showing it
 *   until the new one arrives. It is the cache key, so it is stable per picture and costs nothing outside lists.
 * - `contentFit` is what `resizeMode` was; a picture is never cropped where it was not before. `expo-image` also
 *   decodes at the size of its box, so the old Android `resizeMethod="resize"` is built in.
 * - The placeholder is whatever colour sits behind it (a tile's tint, a surface panel): no blurhash, no spinner.
 */
export function AppImage({
  uri,
  style,
  contentFit = 'cover',
  onError,
  private: keepOffDisk = false,
  onLoad,
  accessibilityLabel,
  accessibilityIgnoresInvertColors,
  testID,
}: AppImageProps) {
  const reduceMotion = useReducedMotion();
  const cacheKey = imageCacheKey(uri);
  return (
    <Image
      source={cacheKey === undefined ? { uri } : { uri, cacheKey }}
      style={style}
      contentFit={contentFit}
      cachePolicy={keepOffDisk ? 'memory' : 'memory-disk'}
      recyclingKey={cacheKey ?? uri}
      transition={reduceMotion ? 0 : IMAGE_TRANSITION_MS}
      onError={onError ? () => onError() : undefined}
      onLoad={onLoad ? () => onLoad() : undefined}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel === undefined ? undefined : 'image'}
      importantForAccessibility={accessibilityLabel === undefined ? 'no' : 'yes'}
      accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
      testID={testID}
    />
  );
}
