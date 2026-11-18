import {
  entryNote,
  figurePieces,
  formatCountdown,
  isActivePlayer,
  istanbulClock,
  istanbulWeekday,
  parseResultsDay,
  spokenSlots,
  tierLeague,
  tierName,
  weekTimeLeft,
} from '@/features/league/labels';
import type { LeagueTodayEntry } from '@/api/models';

import { DAY_CLOSE, leagueMe, notJoined, OUTFIT, WEEK_END } from './fixtures';

const entry = (patch: Partial<LeagueTodayEntry>): LeagueTodayEntry => ({
  status: 'Competing',
  reason: null,
  message: null,
  pieces: [],
  ...patch,
});

describe('tier names', () => {
  it('uses the five names of the rules, and "lig" after them', () => {
    expect(
      (['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const).map((tier) => tierName(tier)),
    ).toEqual(['Bronz', 'Gümüş', 'Altın', 'Platin', 'Elmas']);
    expect(tierLeague('Gold')).toBe('Altın lig');
  });
});

describe('countdowns', () => {
  const MIN = 60_000;
  it('says hours and minutes, minutes alone, and "birazdan" for the last minute', () => {
    expect(formatCountdown(134 * MIN + 30_000)).toBe('2 sa 14 dk');
    expect(formatCountdown(14 * MIN)).toBe('14 dk');
    expect(formatCountdown(30_000)).toBe('birazdan');
    expect(formatCountdown(-5 * MIN)).toBe('birazdan');
  });

  it('counts the week in days, then in hours, then says it is over', () => {
    const end = new Date(WEEK_END).getTime();
    expect(weekTimeLeft(WEEK_END, new Date(end - 3.5 * 24 * 60 * MIN))).toBe('3 gün kaldı');
    expect(weekTimeLeft(WEEK_END, new Date(end - (5 * 60 + 20) * MIN))).toBe('5 sa 20 dk kaldı');
    expect(weekTimeLeft(WEEK_END, new Date(end + MIN))).toBe('Hafta bitti');
  });
});

describe('Istanbul time', () => {
  it('reads the clock and the weekday in Istanbul whatever zone the phone is in', () => {
    expect(istanbulClock(DAY_CLOSE)).toBe('21:00');
    expect(istanbulClock('2026-11-02T18:30:00Z')).toBe('21:30');
    expect(istanbulWeekday(WEEK_END)).toBe('Pazar');
    // 22:00 UTC is already the next day in Istanbul.
    expect(istanbulWeekday('2026-11-01T22:00:00Z')).toBe('Pazartesi');
  });
});

describe('the line under "Bugün giyiyorsun"', () => {
  it('says what the outfit is doing in the league', () => {
    expect(entryNote(entry({ status: 'Competing' }))).toBe('Kombinin ligde yarışıyor');
    expect(entryNote(entry({ status: 'Pending' }))).toBe('Lige hazırlanıyor');
    expect(entryNote(entry({ status: 'Withdrawn' }))).toBe('Kombinini bugünkü yarıştan çıkardın');
    expect(entryNote(null)).toBeNull();
  });

  it('shows the server’s message exactly as it is for every reason and for a removed outfit', () => {
    for (const reason of [
      'RecentlyCompeted',
      'UnsafePiece',
      'IncompleteOutfit',
      'PieceUnavailable',
      'AgeRestricted',
      'NotWorn',
    ] as const) {
      const message = `Sunucunun cümlesi: ${reason}`;
      expect(entryNote(entry({ status: 'NotCompeting', reason, message }))).toBe(message);
    }
    expect(entryNote(entry({ status: 'Removed', message: 'Kaldırıldı.' }))).toBe('Kaldırıldı.');
  });

  it('shows nothing, not an invented line, when the server sends no message', () => {
    expect(entryNote(entry({ status: 'Removed', message: null }))).toBeNull();
    expect(
      entryNote(entry({ status: 'NotCompeting', reason: 'NotWorn', message: null })),
    ).toBeNull();
    expect(entryNote(entry({ status: 'NotCompeting', reason: null, message: null }))).toBeNull();
  });
});

describe('a ?day= from a link', () => {
  it('accepts a real calendar date only', () => {
    expect(parseResultsDay('2026-11-02')).toBe('2026-11-02');
    expect(parseResultsDay(['2026-11-02', 'x'])).toBe('2026-11-02');
    for (const bad of [
      '2026-02-30',
      '2026-13-01',
      '02-11-2026',
      '2026-11-2',
      'latest',
      '',
      undefined,
    ]) {
      expect(parseResultsDay(bad)).toBeNull();
    }
  });
});

describe('players and figures', () => {
  it('takes part only when joined with the current text', () => {
    expect(isActivePlayer(leagueMe())).toBe(true);
    expect(isActivePlayer(leagueMe({ consentRequired: true }))).toBe(false);
    expect(isActivePlayer(notJoined())).toBe(false);
  });

  it('gives the figure components a slot, a picture and the slot’s name, and nothing to buy', () => {
    const pieces = figurePieces(OUTFIT);
    expect(pieces.map((piece) => piece.name)).toEqual(['Üst', 'Alt', 'Ayakkabı']);
    expect(pieces.every((piece) => piece.offer === null && piece.role === 'Wardrobe')).toBe(true);
    expect(spokenSlots(OUTFIT)).toBe('Üst, Alt, Ayakkabı');
  });
});
