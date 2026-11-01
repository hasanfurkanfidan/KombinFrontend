import { dayPart, formatLongDay, formatMonthYear, formatShortDate } from '@/utils/dates';
import { formatAmount, formatTry, toNumber } from '@/utils/money';
import { ablativeSuffix, withAblative } from '@/utils/turkish';

describe('money', () => {
  it('formats whole TRY amounts with dot thousands separators', () => {
    expect(formatTry(2149)).toBe('2.149 ₺');
    expect(formatTry(649)).toBe('649 ₺');
    expect(formatTry(1234567)).toBe('1.234.567 ₺');
    expect(formatTry(0)).toBe('0 ₺');
  });

  it('shows kuruş only when there are any', () => {
    expect(formatTry(649.9)).toBe('649,90 ₺');
    expect(formatAmount(2149.05)).toBe('2.149,05');
    expect(formatAmount(49.0)).toBe('49');
  });

  it('accepts the string form the contract allows', () => {
    expect(formatTry('2149.00')).toBe('2.149 ₺');
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber(7)).toBe(7);
  });

  it('returns an empty amount for garbage', () => {
    expect(formatAmount('abc')).toBe('');
  });
});

describe('dates', () => {
  it('formats month and year in Turkish', () => {
    expect(formatMonthYear('2026-11-15T10:00:00')).toBe('Kasım 2026');
  });

  it('formats chart axis dates', () => {
    expect(formatShortDate('2026-11-01')).toBe('1 Kas');
    expect(formatShortDate('2026-03-15')).toBe('15 Mar');
  });

  it('formats the greeting date', () => {
    expect(formatLongDay(new Date(2026, 10, 1))).toBe('Pazar, 1 Kasım');
  });

  it('splits the day into parts', () => {
    expect(dayPart(new Date(2026, 10, 1, 8))).toBe('morning');
    expect(dayPart(new Date(2026, 10, 1, 14))).toBe('afternoon');
    expect(dayPart(new Date(2026, 10, 1, 21))).toBe('evening');
    expect(dayPart(new Date(2026, 10, 1, 2))).toBe('evening');
  });
});

describe('turkish ablative', () => {
  it.each([
    ['Trendyol', "Trendyol'dan"],
    ['Hepsiburada', "Hepsiburada'dan"],
    ['Koton.com', "Koton.com'dan"],
    ['Boyner', "Boyner'den"],
    ['LC Waikiki', "LC Waikiki'den"],
    ['Mavi', "Mavi'den"],
    ['Zara', "Zara'dan"],
    ['Marka sitesi', "Marka sitesi'den"],
  ])('%s -> %s', (name, expected) => {
    expect(withAblative(name)).toBe(expected);
  });

  it('picks the hard consonant after voiceless endings', () => {
    expect(ablativeSuffix('Ahmet')).toBe('ten');
    expect(ablativeSuffix('Kip')).toBe('ten');
    expect(ablativeSuffix('Altınyıldız')).toBe('dan');
  });
});
