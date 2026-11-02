import { isStale } from '@/features/wardrobe/ItemTile';
import { warningHint } from '@/features/wardrobe/labels';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';

import { wardrobeSummary } from '../../fixtures';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe('"6 ay" pill', () => {
  it('applies to an old item that was never worn or not worn for 180 days', () => {
    expect(isStale(wardrobeSummary({ createdAt: daysAgo(400), lastWornAt: null }))).toBe(true);
    expect(isStale(wardrobeSummary({ createdAt: daysAgo(400), lastWornAt: daysAgo(200) }))).toBe(
      true,
    );
  });

  it('does not apply to a recently worn item or a recently added one', () => {
    expect(isStale(wardrobeSummary({ createdAt: daysAgo(400), lastWornAt: daysAgo(10) }))).toBe(
      false,
    );
    expect(isStale(wardrobeSummary({ createdAt: daysAgo(30), lastWornAt: null }))).toBe(false);
  });
});

describe('quality warnings', () => {
  it('turns the first known warning into a one-line hint', () => {
    expect(warningHint(['person_wearing'])).toBe('Kıyafeti düz bir zeminde çek');
    expect(warningHint(['not_garment', 'blurry'])).toMatch(/bulanık/);
    expect(warningHint(['something_new'])).toBeNull();
    expect(warningHint([])).toBeNull();
  });
});

describe('colorTint', () => {
  it('mixes the colour at 15 % over the card colour', () => {
    // #141414 (Black) at 15 % over #F3F2EE: 0.15 * 20 + 0.85 * 243 = 210 (d2), 0.15 * 20 + 0.85 * 242 = 209 (d1), 0.15 * 20 + 0.85 * 238 = 205 (cd).
    expect(colorTint('Black')).toBe('#d2d1cd');
  });

  it('keeps white and pale garments visible against a white screen', () => {
    expect(colorTint('White')).not.toBe(theme.colors.surface.toLowerCase());
    expect(colorTint('Beige')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
