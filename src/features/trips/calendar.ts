import { tr } from '@/i18n/tr';
import { formatLongDay, monthName } from '@/utils/dates';

/** The contract: a trip is 1-14 days and starts between today and a year ahead. */
export const MAX_TRIP_DAYS = 14;
export const MAX_DAYS_AHEAD = 365;

const DAY_MS = 86_400_000;

/** A `yyyy-MM-dd` string is read as a calendar day (UTC midnight), so no time zone moves it. */
function parse(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

function toUtc(iso: string): number {
  const { year, month, day } = parse(iso);
  return Date.UTC(year, month - 1, day);
}

export function toIso(utc: number): string {
  const date = new Date(utc);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return toIso(toUtc(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Today on the phone's calendar. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Days in a trip, both ends counted: "2026-11-20" to "2026-11-22" is 3. */
export function dayCount(start: string, end: string): number {
  return diffDays(start, end) + 1;
}

/** Every day of the trip, in order. */
export function daysOf(start: string, end: string): string[] {
  return Array.from({ length: dayCount(start, end) }, (_, index) => addDays(start, index));
}

export interface DateRange {
  start: string | null;
  end: string | null;
}

export const EMPTY_RANGE: DateRange = { start: null, end: null };

export function isComplete(range: DateRange): range is { start: string; end: string } {
  return range.start !== null && range.end !== null;
}

/**
 * One tap on a day: the first tap sets the start, the second (a later day, at most 14 days in) the end, the same day
 * twice a one-day trip. A tap before the start moves the start; a tap on a finished range begins a new one.
 */
export function pickDay(range: DateRange, day: string): DateRange {
  if (range.start === null || range.end !== null) {
    return { start: day, end: null };
  }
  if (day < range.start) {
    return { start: day, end: null };
  }
  if (dayCount(range.start, day) > MAX_TRIP_DAYS) {
    return range;
  }
  return { start: range.start, end: day };
}

/** Days outside "today to a year ahead" cannot be picked; while the end is open, neither can a day past the 14th. */
export function isPickable(day: string, range: DateRange, today: string): boolean {
  if (day < today || day > addDays(today, MAX_DAYS_AHEAD)) {
    return false;
  }
  if (range.start !== null && range.end === null && day > range.start) {
    return dayCount(range.start, day) <= MAX_TRIP_DAYS;
  }
  return true;
}

export interface MonthRef {
  year: number;
  /** 0-based. */
  month: number;
}

export function monthOf(iso: string): MonthRef {
  const { year, month } = parse(iso);
  return { year, month: month - 1 };
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + ref.month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function monthTitle(ref: MonthRef): string {
  return `${monthName(ref.month)} ${ref.year}`;
}

/** The month as rows of seven (Monday first); `null` pads the days of the neighbouring months. */
export function monthCells(ref: MonthRef): (string | null)[] {
  const first = Date.UTC(ref.year, ref.month, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= length; day += 1) {
    cells.push(toIso(Date.UTC(ref.year, ref.month, day)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

/** "20 Kasım", "20 – 24 Kasım" or "28 Kasım – 2 Aralık". */
export function formatRange(start: string, end: string): string {
  const from = parse(start);
  const to = parse(end);
  if (start === end) {
    return `${from.day} ${monthName(from.month - 1)}`;
  }
  if (from.month === to.month && from.year === to.year) {
    return `${from.day} – ${to.day} ${monthName(to.month - 1)}`;
  }
  return `${from.day} ${monthName(from.month - 1)} – ${to.day} ${monthName(to.month - 1)}`;
}

/** "Cuma, 20 Kasım". */
export function formatDay(iso: string): string {
  const { year, month, day } = parse(iso);
  return formatLongDay(new Date(year, month - 1, day));
}

/** "20 – 24 Kasım · 5 gün". */
export function formatRangeWithDays(start: string, end: string): string {
  return tr.tripDatesRange(formatRange(start, end), tr.tripDayCount(dayCount(start, end)));
}
