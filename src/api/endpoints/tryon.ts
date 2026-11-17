import { request } from '../client';
import type { ReportTryOnRequest, TryOn } from '../models';

const BASE = '/api/v1/me/tryon';

/** What the mannequin is asked about: one of the user's outfits, or a catalog product with the user's own wardrobe. */
export type TryOnSubject = { kind: 'outfit'; id: string } | { kind: 'product'; id: string };

/**
 * `GET /me/tryon`. A call can make the server draw a new image (30 an hour per user), so only `features/tryon/hooks`
 * asks, under the rules written there. The answer's `imageUrl` is a private one-hour link: it is shown and dropped, never
 * stored, logged or sent to analytics.
 */
export function getTryOn(subject: TryOnSubject, signal?: AbortSignal): Promise<TryOn> {
  return request<TryOn>(BASE, {
    query:
      subject.kind === 'outfit'
        ? { OutfitId: subject.id }
        : { ProductId: subject.id, WithWardrobe: true },
    auth: true,
    signal,
  });
}

/** "Yanlış görünüyor": 204, and the same report twice is stored once. */
export function reportTryOn(body: ReportTryOnRequest): Promise<void> {
  return request<void>(`${BASE}/reports`, { method: 'POST', body, auth: true });
}
