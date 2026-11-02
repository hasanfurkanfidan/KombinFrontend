import { tr } from '@/i18n/tr';

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

/** "2026-11-02" -> "Pazartesi" (the day is read as a calendar date, not shifted by the time zone). */
export function formatWeekday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return WEEKDAYS[weekday] ?? '';
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

/** "14 dk önce", "2 sa önce", "Dün", then a short date ("1 Kas") for anything older. */
export function formatTimeAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) {
    return tr.timeJustNow;
  }
  if (minutes < 60) {
    return tr.timeMinutesAgo(minutes);
  }
  if (minutes < 24 * 60 && then.getDate() === now.getDate()) {
    return tr.timeHoursAgo(Math.floor(minutes / 60));
  }
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (then.getTime() >= startOfYesterday && then.getTime() < startOfYesterday + 24 * 3_600_000) {
    return tr.timeYesterday;
  }
  const month = MONTHS[then.getMonth()];
  return month ? `${then.getDate()} ${month.slice(0, 3)}` : '';
}
