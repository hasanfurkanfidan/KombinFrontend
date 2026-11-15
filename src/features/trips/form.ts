import type { TripPlanRequest } from '@/api/models';
import type { OccasionValue } from '@/features/outfits/labels';
import { tr } from '@/i18n/tr';

import {
  daysOf,
  EMPTY_RANGE,
  isComplete,
  MAX_TRIP_DAYS,
  dayCount,
  type DateRange,
} from './calendar';

/** The contract's bounds for the piece limit and the lengths of the two texts. */
export const MIN_PIECES = 3;
export const MAX_PIECES = 60;
/** The backend has no limit unless one is sent; twenty pieces is a sensible suitcase for most trips. */
export const DEFAULT_MAX_PIECES = 20;
export const MAX_CITY_LENGTH = 80;
export const MAX_NAME_LENGTH = 60;
/** The backend keeps this many saved trips per user. */
export const MAX_SAVED_TRIPS = 50;

export interface TripForm {
  city: string;
  range: DateRange;
  /** A plan per day, by `yyyy-MM-dd`; a day without an entry is "Fark etmez". */
  occasions: Record<string, OccasionValue>;
  maxPieces: number;
  allowRepeatShoes: boolean;
  laundry: boolean;
}

/** The shortest path is the city (taken from the profile when it has one) and the dates; everything else has a default. */
export function defaultTripForm(city = ''): TripForm {
  return {
    city,
    range: EMPTY_RANGE,
    occasions: {},
    maxPieces: DEFAULT_MAX_PIECES,
    allowRepeatShoes: true,
    laundry: false,
  };
}

export interface TripErrors {
  city?: string;
  dates?: string;
}

/** On submit, with the message next to the field; the limits are shown in the picker, so they are not a surprise here. */
export function validateTrip(form: TripForm): TripErrors {
  const errors: TripErrors = {};
  if (form.city.trim() === '') {
    errors.city = tr.tripCityRequired;
  }
  if (!isComplete(form.range) || dayCount(form.range.start, form.range.end) > MAX_TRIP_DAYS) {
    errors.dates = tr.tripDatesRequired;
  }
  return errors;
}

/** The plan request. Plans for days that fell outside a changed range are dropped; none at all is `null`. */
export function buildTripRequest(form: TripForm, personaId?: string): TripPlanRequest {
  const { start, end } = form.range;
  const days = start && end ? daysOf(start, end) : [];
  const occasions = days.flatMap((date) => {
    const occasion = form.occasions[date];
    return occasion ? [{ date, occasion }] : [];
  });
  return {
    city: form.city.trim(),
    startDate: start,
    endDate: end,
    occasions: occasions.length > 0 ? occasions : null,
    maxPieces: form.maxPieces,
    allowRepeatShoes: form.allowRepeatShoes,
    laundry: form.laundry,
    personaId: personaId ?? null,
  };
}

/** Days in the form's range; 0 until both ends are set. */
export function plannedDays(form: TripForm): number {
  return form.range.start && form.range.end ? dayCount(form.range.start, form.range.end) : 0;
}
