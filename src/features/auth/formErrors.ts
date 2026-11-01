import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import type { ApiError } from '@/api/client';

/**
 * Copies the server's per-field validation messages onto the matching form fields.
 * Keys are compared case-insensitively ("Email" and "email" both hit the `email` field).
 * Returns whether at least one message was placed; the caller shows `detail` otherwise.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  let placed = false;
  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const field = fields.find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const message = messages[0];
    if (field && message) {
      setError(field, { message });
      placed = true;
    }
  }
  return placed;
}
