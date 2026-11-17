import { Dimensions, StyleSheet } from 'react-native';
import { act } from '@testing-library/react-native';

/** Queries over what a screen reader would skip: avatars' initials, a badge already in a button's name. */
export const HIDDEN = { includeHiddenElements: true } as const;

/**
 * Runs a test body with the OS text scale set. Jest's window reports an enlarged scale of its own (2), so a test about
 * the default layout must say 1.
 */
export async function withFontScale<T>(fontScale: number, run: () => Promise<T>): Promise<T> {
  const before = Dimensions.get('window');
  Dimensions.set({ window: { ...before, fontScale } });
  try {
    return await run();
  } finally {
    // A mounted component listens to the window: put it back inside act.
    await act(async () => Dimensions.set({ window: before }));
  }
}

/** The flattened style of a rendered element's props. */
export const flat = (style: unknown): Record<string, unknown> =>
  StyleSheet.flatten(style as never) as Record<string, unknown>;
