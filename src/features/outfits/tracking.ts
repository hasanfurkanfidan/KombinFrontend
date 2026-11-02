import { useEffect, useRef } from 'react';

import { track } from '@/analytics';
import type { Outfit } from '@/api/models';

/** One `outfit_view` per outfit that comes on screen; `status` is its completeness (Complete, NeedsOne, CatalogOnly). */
export function useTrackOutfitView(outfit: Outfit | null | undefined): void {
  const viewed = useRef<string | null>(null);
  const id = outfit?.id;
  useEffect(() => {
    if (!outfit || viewed.current === outfit.id) {
      return;
    }
    viewed.current = outfit.id;
    track('outfit_view', {
      kind: outfit.kind,
      status: outfit.completeness,
      ...(outfit.occasion ? { occasion: outfit.occasion.toLowerCase() } : {}),
    });
    // The outfit object changes when it is saved or worn; only a different outfit is a new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
