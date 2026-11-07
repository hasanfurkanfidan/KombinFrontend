import { z } from 'zod';

import { tr } from '@/i18n/tr';

/** The ranges the backend validates `PUT /me/profile` with. */
export const MEASUREMENT_RANGES = {
  heightCm: { min: 120, max: 230, integer: true },
  weightKg: { min: 30, max: 250, integer: false },
  chestCm: { min: 50, max: 200, integer: true },
  waistCm: { min: 50, max: 200, integer: true },
} as const;

/** The backend's limit for `city`; blank clears it. */
export const CITY_MAX_LENGTH = 80;

/** A measurement typed as text: empty clears it, otherwise it must be a number inside the backend's range. */
function measurement({ min, max, integer }: { min: number; max: number; integer: boolean }) {
  return z
    .string()
    .trim()
    .superRefine((text, ctx) => {
      if (text === '') {
        return;
      }
      const value = Number(text.replace(',', '.'));
      if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
        ctx.addIssue({ code: 'custom', message: tr.measurementInvalid });
      } else if (value < min || value > max) {
        ctx.addIssue({ code: 'custom', message: tr.measurementRange(min, max) });
      }
    })
    .transform((text) => (text === '' ? null : Number(text.replace(',', '.'))));
}

export const measurementsSchema = z.object({
  heightCm: measurement(MEASUREMENT_RANGES.heightCm),
  weightKg: measurement(MEASUREMENT_RANGES.weightKg),
  chestCm: measurement(MEASUREMENT_RANGES.chestCm),
  waistCm: measurement(MEASUREMENT_RANGES.waistCm),
  city: z
    .string()
    .trim()
    .max(CITY_MAX_LENGTH, tr.profileCityTooLong)
    .transform((text) => (text === '' ? null : text)),
});

export type MeasurementsInput = z.input<typeof measurementsSchema>;
export type MeasurementsOutput = z.output<typeof measurementsSchema>;
