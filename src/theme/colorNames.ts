import type { ProductColor } from '@/api/models';

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
