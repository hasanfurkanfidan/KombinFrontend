import {
  EMPTY_RANGE,
  addDays,
  dayCount,
  daysOf,
  diffDays,
  formatRange,
  isPickable,
  monthCells,
  pickDay,
  shiftMonth,
  todayIso,
} from '@/features/trips/calendar';

describe('calendar days', () => {
  it('does arithmetic on calendar days, not instants', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(diffDays('2026-11-20', '2026-11-24')).toBe(4);
    expect(dayCount('2026-11-20', '2026-11-20')).toBe(1);
    expect(daysOf('2026-11-29', '2026-12-01')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });

  it('reads today on the phone', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('writes a range the short way', () => {
    expect(formatRange('2026-11-20', '2026-11-20')).toBe('20 Kasım');
    expect(formatRange('2026-11-20', '2026-11-24')).toBe('20 – 24 Kasım');
    expect(formatRange('2026-11-28', '2026-12-02')).toBe('28 Kasım – 2 Aralık');
  });
});

describe('picking a range', () => {
  it('takes the start first, then a later day as the end', () => {
    const start = pickDay(EMPTY_RANGE, '2026-11-20');
    expect(start).toEqual({ start: '2026-11-20', end: null });
    expect(pickDay(start, '2026-11-24')).toEqual({ start: '2026-11-20', end: '2026-11-24' });
  });

  it('makes the same day twice a one-day trip', () => {
    const start = pickDay(EMPTY_RANGE, '2026-11-20');
    expect(pickDay(start, '2026-11-20')).toEqual({ start: '2026-11-20', end: '2026-11-20' });
  });

  it('moves the start when an earlier day is tapped, and starts over after a finished range', () => {
    const start = pickDay(EMPTY_RANGE, '2026-11-20');
    expect(pickDay(start, '2026-11-18')).toEqual({ start: '2026-11-18', end: null });
    const done = { start: '2026-11-20', end: '2026-11-22' };
    expect(pickDay(done, '2026-12-01')).toEqual({ start: '2026-12-01', end: null });
  });

  it('refuses a 15th day: the 14th (3 December) is the last one', () => {
    const start = pickDay(EMPTY_RANGE, '2026-11-20');
    expect(pickDay(start, '2026-12-03')).toEqual({ start: '2026-11-20', end: '2026-12-03' });
    expect(pickDay(start, '2026-12-04')).toBe(start);
  });

  it('cannot pick the past, past a year ahead, or past the 14th day of an open range', () => {
    const today = '2026-11-15';
    expect(isPickable('2026-11-14', EMPTY_RANGE, today)).toBe(false);
    expect(isPickable('2026-11-15', EMPTY_RANGE, today)).toBe(true);
    expect(isPickable('2027-11-15', EMPTY_RANGE, today)).toBe(true);
    expect(isPickable('2027-11-16', EMPTY_RANGE, today)).toBe(false);
    const open = { start: '2026-11-20', end: null };
    expect(isPickable('2026-12-03', open, today)).toBe(true);
    expect(isPickable('2026-12-04', open, today)).toBe(false);
    // Before the start is allowed: it moves the start.
    expect(isPickable('2026-11-16', open, today)).toBe(true);
  });
});

describe('the month grid', () => {
  it('starts on Monday and pads to whole weeks', () => {
    // 1 November 2026 is a Sunday: six blanks, then the 30 days, then blanks to a full week.
    const cells = monthCells({ year: 2026, month: 10 });
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe('2026-11-01');
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(cells.length % 7).toBe(0);
  });

  it('moves across the year', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});
