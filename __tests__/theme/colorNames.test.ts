import openapi from '../../docs/openapi.json';

import type { ProductColor } from '@/api/models';
import { theme } from '@/theme';

// Type level: this fails to compile when the generated `ProductColor` has a value `colorNames` lacks, or the reverse.
type Missing = Exclude<ProductColor, keyof typeof theme.colorNames>;
type Extra = Exclude<keyof typeof theme.colorNames, ProductColor>;
const noneMissing: [Missing] extends [never] ? true : false = true;
const noneExtra: [Extra] extends [never] ? true : false = true;

describe('theme.colorNames', () => {
  it('has a swatch for every ProductColor of the contract (type level)', () => {
    expect(noneMissing && noneExtra).toBe(true);
  });

  it('matches the enum in docs/openapi.json at runtime', () => {
    const contractColors = openapi.components.schemas.ProductColor.enum;
    expect([...contractColors].sort()).toEqual(Object.keys(theme.colorNames).sort());
  });

  it('maps every colour to a hex value', () => {
    for (const hex of Object.values(theme.colorNames)) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
