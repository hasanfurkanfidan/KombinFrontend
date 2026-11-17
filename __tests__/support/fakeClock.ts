// Moves the clock without touching a timer: only `Date` is faked, so `waitFor`, query retries and debounces keep
// running on real time (a test that needs those stopped uses `jest.useFakeTimers()` itself).
const KEEP_REAL = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

/** 09:00 in Istanbul on Monday 2 November 2026: the morning, today's card. The default outfit fixture is for this day. */
export const MORNING = '2026-11-02T06:00:00Z';
/** 20:00 in Istanbul the same day: after 18:00, the card is about tomorrow. */
export const EVENING = '2026-11-02T17:00:00Z';
/** The Istanbul calendar day of both instants above. */
export const TODAY = '2026-11-02';

export function freezeClockAt(iso: string): void {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: [...KEEP_REAL] });
}

/** Moves a frozen clock (midnight passing while the app is open). */
export function moveClockTo(iso: string): void {
  jest.setSystemTime(new Date(iso));
}

export function unfreezeClock(): void {
  jest.useRealTimers();
}
