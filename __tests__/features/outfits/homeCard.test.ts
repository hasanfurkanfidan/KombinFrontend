import { theme } from '@/theme';
import {
  canWearOutfit,
  homeCardDay,
  homeCardPrimary,
  homeCardState,
  istanbulDay,
  wornToday,
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
  // Instants are UTC: Istanbul is UTC+3, so 15:00Z is 18:00 there. The device-zone cases are in __tests__/clock.
  it('is today until 18:00 in Istanbul, and nothing but the clock moves it', () => {
    expect(homeCardDay(new Date('2026-11-07T21:01:00Z'))).toBe('today');
    expect(homeCardDay(new Date('2026-11-08T06:00:00Z'))).toBe('today');
    expect(homeCardDay(new Date('2026-11-08T10:00:00Z'))).toBe('today');
    expect(homeCardDay(new Date('2026-11-08T14:59:00Z'))).toBe('today');
  });

  it('is tomorrow from 18:00 on', () => {
    expect(homeCardDay(new Date('2026-11-08T15:00:00Z'))).toBe('tomorrow');
    expect(homeCardDay(new Date('2026-11-08T19:00:00Z'))).toBe('tomorrow');
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
  // Monday 2 November 2026, 09:00 in Istanbul.
  const now = new Date('2026-11-02T06:00:00Z');
  const complete = { completeness: 'Complete', date: '2026-11-02' } as const;

  it('offers "wear" only for a complete outfit that is about today', () => {
    expect(homeCardPrimary(complete, 'today', now)).toBe('wear');
    expect(homeCardPrimary({ ...complete, completeness: 'NeedsOne' }, 'today', now)).toBe('open');
    expect(homeCardPrimary({ ...complete, completeness: 'CatalogOnly' }, 'today', now)).toBe(
      'open',
    );
    expect(homeCardPrimary(complete, 'tomorrow', now)).toBe('open');
    expect(homeCardPrimary(null, 'today', now)).toBe('open');
  });

  it('does not offer "wear" for an outfit of another day: the backend records the wear for today', () => {
    expect(homeCardPrimary({ ...complete, date: '2026-11-03' }, 'today', now)).toBe('open');
    expect(homeCardPrimary({ ...complete, date: '2026-11-01' }, 'today', now)).toBe('open');
  });
});

describe('wornToday', () => {
  const now = new Date('2026-11-02T06:00:00Z');

  it('needs both the outfit and the wear mark to be today in Istanbul', () => {
    expect(wornToday({ date: '2026-11-02', wornAt: '2026-11-02T05:00:00Z' }, now)).toBe(true);
    // 00:30 Istanbul on the 2nd is 21:30Z on the 1st: still today's.
    expect(wornToday({ date: '2026-11-02', wornAt: '2026-11-01T21:30:00Z' }, now)).toBe(true);
  });

  it('is not settled by yesterday evening’s mark, nor by a mark on another day’s outfit', () => {
    // 23:30 Istanbul time on the 1st.
    expect(wornToday({ date: '2026-11-02', wornAt: '2026-11-01T20:30:00Z' }, now)).toBe(false);
    expect(wornToday({ date: '2026-11-03', wornAt: '2026-11-02T05:00:00Z' }, now)).toBe(false);
    expect(wornToday({ date: '2026-11-02', wornAt: null }, now)).toBe(false);
  });

  it('knows which outfits may be worn at all', () => {
    expect(canWearOutfit({ date: '2026-11-02' }, now)).toBe(true);
    expect(canWearOutfit({ date: '2026-11-03' }, now)).toBe(false);
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
