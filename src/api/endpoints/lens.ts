import { File as FsFile } from 'expo-file-system';

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
 * `POST /lens/search`: the photo goes up as multipart field `image` and is never stored.
 *
 * The part is an `expo-file-system` `File` (a `Blob` with its file name and MIME type, read through `bytes()`). The
 * global `fetch` on SDK 58 is `expo/fetch`, whose FormData encoder rejects React Native's `{ uri, name, type }` part
 * ("`uri` is not supported"): such a request never leaves the phone. The backend checks the part's content type, which
 * `File` derives from the `.jpg` the manipulator wrote.
 */
export function searchLens(input: LensSearchInput): Promise<LensSearchResult> {
  const form = new FormData();
  form.append('image', new FsFile(input.uri));
  return request<LensSearchResult>('/api/v1/lens/search', {
    method: 'POST',
    query: { audience: input.audience },
    form,
    auth: input.signedIn,
    signal: input.signal,
  });
}
