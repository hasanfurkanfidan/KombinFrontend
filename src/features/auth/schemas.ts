import { z } from 'zod';

import { tr } from '@/i18n/tr';

// These mirror the backend rules: valid email, password >= 8 with a letter and a digit, name 2-50.
const email = z
  .string()
  .trim()
  .min(1, tr.validationEmailRequired)
  .pipe(z.email(tr.validationEmailInvalid));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, tr.validationPasswordRequired),
});

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, tr.validationDisplayNameMin)
    .max(50, tr.validationDisplayNameMax),
  email,
  password: z
    .string()
    .min(8, tr.validationPasswordMin)
    .regex(/\p{L}/u, tr.validationPasswordLetter)
    .regex(/\d/, tr.validationPasswordDigit),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
