import { homeCardDay, homeCardState } from '@/features/outfits/homeCard';

describe('home card gating', () => {
  it('asks for the outfit only when signed in with at least one piece', () => {
    expect(homeCardState({ isSignedIn: true, itemCount: 1, statsPending: false })).toBe('outfit');
    expect(homeCardState({ isSignedIn: true, itemCount: 48, statsPending: false })).toBe('outfit');
  });

  it('shows the prompt for an empty wardrobe', () => {
    expect(homeCardState({ isSignedIn: true, itemCount: 0, statsPending: false })).toBe('prompt');
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
  it('is today until noon and tomorrow from noon on', () => {
    expect(homeCardDay(new Date(2026, 10, 8, 8, 30))).toBe('today');
    expect(homeCardDay(new Date(2026, 10, 8, 11, 59))).toBe('today');
    expect(homeCardDay(new Date(2026, 10, 8, 12, 0))).toBe('tomorrow');
    expect(homeCardDay(new Date(2026, 10, 8, 22, 0))).toBe('tomorrow');
  });
});
