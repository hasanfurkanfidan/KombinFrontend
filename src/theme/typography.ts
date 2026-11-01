import type { TextStyle } from 'react-native';

export const fontFamilies = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyStrong: 'Inter_600SemiBold',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    lineHeight: 24,
  },
  headingLarge: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    lineHeight: 26,
  },
  priceLarge: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 22,
    lineHeight: 28,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyMedium: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyStrong: {
    fontFamily: fontFamilies.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 16,
  },
  captionMedium: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  overline: {
    fontFamily: fontFamilies.bodyStrong,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
} satisfies Record<string, TextStyle>;
