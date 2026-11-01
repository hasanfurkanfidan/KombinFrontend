const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** "2026-11-01T10:00:00Z" -> "Kasım 2026". */
export function formatMonthYear(iso: string): string {
  const date = new Date(iso);
  const month = MONTHS[date.getMonth()];
  return month ? `${month} ${date.getFullYear()}` : '';
}

/** "2026-11-01" -> "1 Kas" (chart axis labels). */
export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name.slice(0, 3)}` : isoDate;
}

/** "Cumartesi, 1 Kasım". */
export function formatLongDay(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export function dayPart(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/** Days since the epoch for a "YYYY-MM-DD" string, used to place chart points proportionally in time. */
export function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}
