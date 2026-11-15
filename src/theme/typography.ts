import type { TextStyle } from 'react-native';

/**
 * Archivo, one family. React Native has no variable axes, so each face is a static instance: three normal-width
 * weights come from `@expo-google-fonts/archivo`, the two narrower bold cuts from `assets/fonts` (see AppProviders).
 * Normal-width bold (700) is not loaded: no style uses it, and every face is a startup font load and ~120 KB.
 */
export const fontFamilies = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  /** SemiCondensed Bold: display and title. */
  display: 'ArchivoSemiCondensed_700Bold',
  /** Condensed Bold: prices and "Sana uygun %N". */
  numeric: 'ArchivoCondensed_700Bold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const typography = {
  /** Top-level screen titles (the five tabs, auth, onboarding). */
  display: {
    fontFamily: fontFamilies.display,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.5,
  },
  /** Titles of pushed screens and sheets. */
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: fontFamilies.semibold,
    fontSize: 20,
    lineHeight: 25,
  },
  subhead: {
    fontFamily: fontFamilies.semibold,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  /** Buttons, chips, row titles. */
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  captionMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  /** Small labels that used to be all-caps overlines: sentence case, weight instead of tracking. */
  captionStrong: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  tab: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    lineHeight: 14,
  },
  /** A price in a card or row. */
  price: {
    fontFamily: fontFamilies.numeric,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: tabular,
  },
  priceLarge: {
    fontFamily: fontFamilies.numeric,
    fontSize: 24,
    lineHeight: 29,
    fontVariant: tabular,
  },
  /** "Sana uygun %N". */
  match: {
    fontFamily: fontFamilies.numeric,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: tabular,
  },
  /** Counts and figures inside body-sized text. */
  numeric: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    lineHeight: 22,
    fontVariant: tabular,
  },
} satisfies Record<string, TextStyle>;
