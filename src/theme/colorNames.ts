import type { ProductColor } from '@/api/models';

import { colors } from './tokens';

/**
 * Swatch colours for the product colour names the backend uses (persona style summaries list them).
 * A `Record` over the generated union: a new backend colour fails the typecheck until it gets a swatch.
 */
export const colorNames: Record<ProductColor, string> = {
  Black: '#141414',
  White: '#FFFFFF',
  Grey: '#9A9A96',
  Navy: '#1F2A44',
  Blue: '#7B93AD',
  Green: '#2A3A2E',
  Beige: '#D8D3C4',
  Brown: '#8A6A4A',
  Red: '#A8322D',
  Pink: '#E4A9B4',
  Purple: '#6B4C7A',
  Yellow: '#E2C044',
  Orange: '#D9803A',
  Multi: '#C9B8A8',
  Other: '#B5B3AC',
};

const channel = (hex: string, start: number) => parseInt(hex.slice(start, start + 2), 16);

/**
 * The tinted tile background behind a garment: the colour at `alpha` (15 % by default) over the card colour, as an
 * opaque hex. Composited here rather than with an overlay so white and pale garments still get a visible tile.
 */
export function colorTint(name: ProductColor, alpha = 0.15): string {
  const color = colorNames[name];
  const base = colors.surfaceAlt;
  const mixed = [1, 3, 5].map((start) =>
    Math.round(channel(color, start) * alpha + channel(base, start) * (1 - alpha)),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
