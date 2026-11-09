import { request } from '../client';
import type { LensSearchResult } from '../models';

export interface LensSearchInput {
  /** The re-encoded JPEG on the phone. */
  uri: string;
  /** `all` drops the audience filter; left out, a signed-in caller's profile audience applies. */
  audience?: 'all';
  /** A bearer token adds the caller's wardrobe matches and profile audience; the search itself is public. */
  signedIn: boolean;
  signal?: AbortSignal;
}

/**
 * `POST /lens/search`: the photo goes up as multipart field `image` and is never stored. React Native's `FormData`
 * streams a `{ uri, name, type }` part from the file natively (no `Blob` body, see `putPhoto`).
 */
export function searchLens(input: LensSearchInput): Promise<LensSearchResult> {
  const form = new FormData();
  // React Native's file part; the DOM typings only know `string | Blob`.
  const part = { uri: input.uri, name: 'lens.jpg', type: 'image/jpeg' };
  form.append('image', part as unknown as Blob);
  return request<LensSearchResult>('/api/v1/lens/search', {
    method: 'POST',
    query: { audience: input.audience },
    form,
    auth: input.signedIn,
    signal: input.signal,
  });
}
