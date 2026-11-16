import { theme } from '@/theme';
import {
  homeCardDay,
  homeCardPrimary,
  homeCardState,
  istanbulDay,
} from '@/features/outfits/homeCard';

describe('home card gating', () => {
  it('asks for the outfit only when signed in with at least one piece', () => {
    expect(homeCardState({ isSignedIn: true, itemCount: 1, statsPending: false })).toBe('outfit');
    expect(homeCardState({ isSignedIn: true, itemCount: 48, statsPending: false })).toBe('outfit');
  });

  it('gives a signed-in user with an empty wardrobe the first-morning card', () => {
    expect(homeCardState({ isSignedIn: true, itemCount: 0, statsPending: false })).toBe('empty');
  });

  it('shows the prompt when logged out, whatever the stats say', () => {
    expect(homeCardState({ isSignedIn: false, itemCount: undefined, statsPending: false })).toBe(
      'prompt',
    );
    expect(homeCardState({ isSignedIn: false, itemCount: 12, statsPending: false })).toBe('prompt');
  });

  it('waits while the piece count is unknown, and falls back to the prompt if it never came', () => {
    expect(homeCardState({ isSignedIn: true, itemCount: undefined, statsPending: true })).toBe(
      'loading',
    );
    expect(homeCardState({ isSignedIn: true, itemCount: undefined, statsPending: false })).toBe(
      'prompt',
    );
  });
});

describe('homeCardDay', () => {
  it('is today until 18:00, and nothing but the clock moves it', () => {
    expect(homeCardDay(new Date(2026, 10, 8, 0, 1))).toBe('today');
    expect(homeCardDay(new Date(2026, 10, 8, 9, 0))).toBe('today');
    expect(homeCardDay(new Date(2026, 10, 8, 13, 0))).toBe('today');
    expect(homeCardDay(new Date(2026, 10, 8, 17, 59))).toBe('today');
  });

  it('is tomorrow from 18:00 on', () => {
    expect(homeCardDay(new Date(2026, 10, 8, 18, 0))).toBe('tomorrow');
    expect(homeCardDay(new Date(2026, 10, 8, 22, 0))).toBe('tomorrow');
  });
});

describe('istanbulDay', () => {
  it('is the Europe/Istanbul calendar day (UTC+3, no daylight saving), zero padded', () => {
    expect(istanbulDay(new Date('2026-01-05T10:00:00Z'))).toBe('2026-01-05');
    // 21:00 UTC is already past midnight in Istanbul; 20:59 UTC is not.
    expect(istanbulDay(new Date('2026-11-08T21:00:00Z'))).toBe('2026-11-09');
    expect(istanbulDay(new Date('2026-11-08T20:59:00Z'))).toBe('2026-11-08');
    // Summer time elsewhere does not move it.
    expect(istanbulDay(new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-02');
  });
});

describe('homeCardPrimary', () => {
  it('offers "wear" only for a complete outfit today', () => {
    expect(homeCardPrimary({ completeness: 'Complete' }, 'today')).toBe('wear');
    expect(homeCardPrimary({ completeness: 'NeedsOne' }, 'today')).toBe('open');
    expect(homeCardPrimary({ completeness: 'CatalogOnly' }, 'today')).toBe('open');
    expect(homeCardPrimary({ completeness: 'Complete' }, 'tomorrow')).toBe('open');
    expect(homeCardPrimary(null, 'today')).toBe('open');
  });
});

describe('card height', () => {
  it('keeps the two-action card within 280 pt at the default text size', () => {
    // Padding above and below, the figure beside the text, the gap, the buttons: the tallest state.
    const figure =
      theme.sizes.homeFigureTorso +
      theme.sizes.homeFigureBottom +
      theme.sizes.homeFigureShoes +
      2 * theme.spacing.xs;
    const height = 2 * theme.spacing.xl + figure + theme.spacing.md + theme.sizes.buttonHeight;
    expect(height).toBe(274);
    expect(height).toBeLessThanOrEqual(280);
  });
});
