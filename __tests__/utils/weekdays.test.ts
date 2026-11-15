import { dateOptions } from '@/features/budget/form';
import { formatShortWeekday, formatWeekday } from '@/utils/dates';

describe('short weekdays', () => {
  // 2026-11-16 is a Monday.
  const week = Array.from({ length: 7 }, (_, index) => `2026-11-${16 + index}`);

  it('are a fixed table, so no two days read alike', () => {
    expect(week.map(formatShortWeekday)).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
    expect(new Set(week.map(formatShortWeekday)).size).toBe(7);
  });

  it('read a Saturday as "Cmt" and keep the full name for speaking', () => {
    expect(formatShortWeekday('2026-11-21')).toBe('Cmt');
    expect(formatWeekday('2026-11-21')).toBe('Cumartesi');
  });

  it('give the budget date chips distinct labels and full spoken names', () => {
    // Sunday 15 November: the chips run from Tuesday 17th to Sunday 22nd.
    const options = dateOptions(new Date(2026, 10, 15)).slice(2);
    expect(options.map((option) => option.label)).toEqual([
      'Sal 17',
      'Çar 18',
      'Per 19',
      'Cum 20',
      'Cmt 21',
      'Paz 22',
    ]);
    expect(options[4]?.spoken).toBe('Cumartesi, 21 Kasım');
    // Every day of a week, whichever day it starts on.
    for (let start = 1; start <= 7; start += 1) {
      const labels = dateOptions(new Date(2026, 10, start))
        .slice(2)
        .map((o) => o.label.split(' ')[0]);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});
