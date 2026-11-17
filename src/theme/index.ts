import { colorNames } from './colorNames';
import { arena, colors, motion, radius, sizes } from './tokens';
import { gridGap, screenPaddingX, spacing } from './spacing';
import { fontFamilies, typography } from './typography';

export const theme = {
  colors,
  arena,
  colorNames,
  radius,
  sizes,
  motion,
  spacing,
  screenPaddingX,
  gridGap,
  typography,
  fontFamilies,
} as const;

export type Theme = typeof theme;
