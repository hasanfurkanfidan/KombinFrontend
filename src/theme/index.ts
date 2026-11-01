import { colors, radius, shadows, sizes } from './tokens';
import { gridGap, screenPaddingX, spacing } from './spacing';
import { fontFamilies, typography } from './typography';

export const theme = {
  colors,
  radius,
  sizes,
  shadows,
  spacing,
  screenPaddingX,
  gridGap,
  typography,
  fontFamilies,
} as const;

export type Theme = typeof theme;
