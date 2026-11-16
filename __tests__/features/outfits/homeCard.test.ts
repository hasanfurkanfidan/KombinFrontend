import { theme } from '@/theme';
import { homeCardDay, homeCardPrimary, homeCardState, localDay } from '@/features/outfits/homeCard';

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
  it('is today before 18:00 while today’s outfit is not worn', () => {
    expect(homeCardDay(new Date(2026, 10, 8, 8, 30))).toBe('today');
    expect(homeCardDay(new Date(2026, 10, 8, 12, 30), false)).toBe('today');
    expect(homeCardDay(new Date(2026, 10, 8, 17, 59), false)).toBe('today');
  });

  it('is tomorrow once today’s outfit is worn, whatever the time', () => {
    expect(homeCardDay(new Date(2026, 10, 8, 7, 0), true)).toBe('tomorrow');
    expect(homeCardDay(new Date(2026, 10, 8, 12, 30), true)).toBe('tomorrow');
  });

  it('is tomorrow from 18:00 on', () => {
    expect(homeCardDay(new Date(2026, 10, 8, 18, 0))).toBe('tomorrow');
    expect(homeCardDay(new Date(2026, 10, 8, 22, 0), false)).toBe('tomorrow');
  });
});

describe('localDay', () => {
  it('is the device’s calendar day, zero padded', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 10, 8, 0, 1))).toBe('2026-11-08');
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
