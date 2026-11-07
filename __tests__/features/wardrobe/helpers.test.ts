import { companionCaption } from '@/features/wardrobe/ItemTile';
import { warningHint } from '@/features/wardrobe/labels';
import { theme } from '@/theme';
import { colorTint } from '@/theme/colorNames';

import { wardrobeSummary } from '../../fixtures';

describe('pairing caption', () => {
  it('counts the pieces a finished item goes with', () => {
    expect(companionCaption(wardrobeSummary({ companionCount: 5 }))).toBe('5 parçayla gider');
    expect(companionCaption(wardrobeSummary({ companionCount: '3' }))).toBe('3 parçayla gider');
  });

  it('says nothing matches when the count is zero', () => {
    expect(companionCaption(wardrobeSummary({ companionCount: 0 }))).toBe('Eşleşen parça yok');
  });

  it('is hidden while processing or failed, or before the backend has counted', () => {
    expect(
      companionCaption(wardrobeSummary({ status: 'Processing', companionCount: 0 })),
    ).toBeNull();
    expect(companionCaption(wardrobeSummary({ status: 'Failed', companionCount: 0 }))).toBeNull();
    expect(companionCaption(wardrobeSummary({ companionCount: undefined }))).toBeNull();
    expect(companionCaption(wardrobeSummary({ companionCount: null }))).toBeNull();
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
