import { Image, type ImageStyle, type StyleProp } from 'react-native';

export interface AppImageProps {
  /** A remote URL or a local `file://` URI. */
  uri: string;
  /** Sized by its style (fill a box, or explicit width/height): an image never decides its own size. */
  style: StyleProp<ImageStyle>;
  /** Same names as `expo-image`'s `contentFit`, so a later swap keeps every call site. */
  contentFit?: 'cover' | 'contain';
  onError?: () => void;
  /**
   * What the picture shows, when it carries information a screen reader user would miss. Without it the image is
   * decorative: hidden from the tree (the name and price beside it already say what it is).
   */
  accessibilityLabel?: string;
  accessibilityIgnoresInvertColors?: boolean;
  testID?: string;
}

/**
 * The one image component of the app. Today it is React Native's `Image` with `resizeMethod="resize"`: on Android the
 * photo is decoded at the size of its box instead of at full resolution (a 1600 px photo in a 120 px tile costs about
 * 60 KB of memory instead of 10 MB); iOS already decodes at display size.
 *
 * Swapping to `expo-image` (memory and disk cache across launches, downsampling, recycling in lists) changes only this
 * file, but it is a native module: it needs a new development build, see `docs/mobile-review.md`.
 */
export function AppImage({
  uri,
  style,
  contentFit = 'cover',
  onError,
  accessibilityLabel,
  accessibilityIgnoresInvertColors,
  testID,
}: AppImageProps) {
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={contentFit}
      resizeMethod="resize"
      onError={onError ? () => onError() : undefined}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel === undefined ? undefined : 'image'}
      importantForAccessibility={accessibilityLabel === undefined ? 'no' : 'yes'}
      accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
      testID={testID}
    />
  );
}
