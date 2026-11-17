/**
 * The app's one clock: Europe/Istanbul. The backend decides what "today" is (outfits, budget and trip dates) in that
 * zone, so every "what day is it" and "what hour is it" question here is answered in it too, whatever zone the phone is
 * set to. Turkey has no daylight saving time since 2016: it is always UTC+3, so plain arithmetic is enough and nothing
 * depends on `Intl` time-zone support.
 */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** `now` moved to Istanbul: read it with the `getUTC*` methods only. */
function shifted(now: Date): Date {
  return new Date(now.getTime() + ISTANBUL_OFFSET_MS);
}

/** The calendar day in Europe/Istanbul as `yyyy-MM-dd`. */
export function istanbulDay(now: Date): string {
  return shifted(now).toISOString().slice(0, 10);
}

/** The hour of the day in Europe/Istanbul, 0-23. */
export function istanbulHour(now: Date): number {
  return shifted(now).getUTCHours();
}
