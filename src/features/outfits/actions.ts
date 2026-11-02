import { track } from '@/analytics';
import type { Outfit, OutfitPiece } from '@/api/models';
import { showToast } from '@/components/toastStore';
import { openOffer } from '@/features/catalog/buy';
import { useActivePersona } from '@/features/personas/hooks';
import { tr } from '@/i18n/tr';

import { useSaveOutfit, useWearOutfit } from './hooks';

export interface OutfitActions {
  saved: boolean;
  worn: boolean;
  saving: boolean;
  wearing: boolean;
  save: () => void;
  wear: () => void;
  /** Opens the piece's cheapest offer through the backend redirect (`src=outfit`). */
  buy: (piece: OutfitPiece) => void;
}

/** Save, wear and buy for one outfit; each reports its `outfit_feedback` / `outfit_gap_click` event. */
export function useOutfitActions(outfit: Outfit): OutfitActions {
  const save = useSaveOutfit();
  const wear = useWearOutfit();
  const personaId = useActivePersona()?.id;

  return {
    saved: outfit.savedAt !== null,
    worn: outfit.wornAt !== null,
    saving: save.isPending,
    wearing: wear.isPending,
    save: () => {
      track('outfit_feedback', { action: 'Save' });
      save.mutate(outfit.id, {
        onSuccess: () => showToast(tr.outfitSavedToast),
        onError: () => showToast(tr.outfitActionFailed),
      });
    },
    wear: () => {
      track('outfit_feedback', { action: 'Worn' });
      wear.mutate(outfit.id, {
        onSuccess: () => showToast(tr.outfitWornToast),
        onError: () => showToast(tr.outfitActionFailed),
      });
    },
    buy: (piece) => {
      if (!piece.offer) {
        return;
      }
      track('outfit_gap_click', {});
      void openOffer(
        { id: piece.offer.offerId, goPath: piece.offer.goPath },
        { source: 'outfit', personaId },
      );
    },
  };
}
