import { ApiError } from '@/api/client';
import { tr } from '@/i18n/tr';

/**
 * "Çok fazla deneme yaptın. 3 dakika sonra tekrar dene." (seconds under a minute, minutes rounded up);
 * without a usable `Retry-After` the second sentence is the generic one.
 */
export function rateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return tr.rateLimitedSoon;
  }
  if (retryAfterSeconds < 60) {
    return tr.rateLimited(Math.max(1, retryAfterSeconds), 'saniye');
  }
  return tr.rateLimited(Math.ceil(retryAfterSeconds / 60), 'dakika');
}

/** The sentence for a 429, or `null` when `error` is anything else. */
export function rateLimitedText(error: unknown): string | null {
  return error instanceof ApiError && error.isRateLimited
    ? rateLimitMessage(error.retryAfterSeconds)
    : null;
}
