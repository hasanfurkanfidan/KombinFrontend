import { useMutation } from '@tanstack/react-query';

import { track } from '@/analytics';
import { searchLens } from '@/api/endpoints/lens';
import type { LensSearchResult } from '@/api/models';
import type { PickedPhoto } from '@/features/wardrobe/addStore';
import { useSession } from '@/session/useSession';

import { prepareLensPhoto, type LensPhoto } from './photo';

export type LensSource = 'camera' | 'gallery';

export interface LensSearchVariables {
  /** The picked photo, or the one already sent (`prepared`), which a re-run reuses as it is. */
  photo: PickedPhoto;
  prepared: boolean;
  source: LensSource;
  /** `all` drops the audience filter the backend applied. */
  audience?: 'all';
}

export interface LensSearchOutcome {
  result: LensSearchResult;
  photo: LensPhoto;
}

/**
 * One visual search: downscale (first run only), upload, answer. It is a mutation, not a query: a photo is sent once
 * and nothing is cached. `lens_search` is timed on the device from the downscale to the answer.
 */
export function useLensSearch() {
  const { isSignedIn } = useSession();
  return useMutation({
    mutationFn: async ({
      photo,
      prepared,
      source,
      audience,
    }: LensSearchVariables): Promise<LensSearchOutcome> => {
      const startedAt = Date.now();
      const sent: LensPhoto =
        prepared && photo.width && photo.height
          ? { uri: photo.uri, width: photo.width, height: photo.height }
          : await prepareLensPhoto(photo);
      const result = await searchLens({ uri: sent.uri, audience, signedIn: isSignedIn });
      track('lens_search', {
        regionCount: result.regions.length,
        resultCount: result.regions.reduce((sum, region) => sum + region.results.length, 0),
        durationMs: Date.now() - startedAt,
        source,
      });
      return { result, photo: sent };
    },
  });
}
