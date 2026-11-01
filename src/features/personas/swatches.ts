import type { ProductColor } from '@/api/models';
import { theme } from '@/theme';

/** Swatch colour for a colour name from a style summary; the summary types them as plain strings. */
export function swatchColor(name: string): string {
  return Object.hasOwn(theme.colorNames, name)
    ? theme.colorNames[name as ProductColor]
    : theme.colors.borderStrong;
}
