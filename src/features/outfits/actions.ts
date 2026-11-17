import { track } from '@/analytics';
import { recordOutfitFeedback } from '@/api/endpoints/outfits';
import type { Outfit, OutfitPiece } from '@/api/models';
import { showToast } from '@/components/toastStore';
import { openOffer } from '@/features/catalog/buy';
import { useActivePersona } from '@/features/personas/hooks';
import { tr } from '@/i18n/tr';

import { canWearOutfit } from './homeCard';
import { useSaveOutfit, useWearOutfit } from './hooks';

export interface WearOptions {
  /** Skip the "Bugün giydin" toast, for a screen that already shows the settled state. */
  quiet?: boolean;
  /** Called once the backend has the outfit as worn (not when the caller has unmounted meanwhile). */
  onWorn?: () => void;
  /** Called when the request failed (the usual toast is shown too). */
  onError?: () => void;
}

/** The "shuffle" report of the daily screen and the home card: the event, then the backend's feedback (best effort). */
export function reportShuffle(outfit: Outfit | null | undefined): void {
  track('outfit_shuffle', {});
  if (outfit) {
    track('outfit_feedback', { action: 'Shuffle' });
    // The backend only records it; a failure changes nothing for the user.
    void recordOutfitFeedback(outfit.id, { action: 'Shuffle', reason: null }).catch(
      () => undefined,
    );
  }
}

/**
 * "Bugün giydim" for any outfit: the one path the outfit sheet and the home card share (event, request, cache patch,
 * toasts). `wearing` is true while the request is out. Remembering the worn outfit for Keşfet's card is the mutation's
 * own job (`useWearOutfit`), so it happens even when the screen that tapped is gone by the time the answer comes.
 */
export function useWear() {
  const wear = useWearOutfit();
  return {
    wearing: wear.isPending,
    wear: (id: string, options: WearOptions = {}) => {
      track('outfit_feedback', { action: 'Worn' });
      wear.mutate(id, {
        onSuccess: () => {
          if (!options.quiet) {
            showToast(tr.outfitWornToast);
          }
          options.onWorn?.();
        },
        onError: () => {
          showToast(tr.outfitActionFailed);
          options.onError?.();
        },
      });
    },
  };
}

export interface OutfitActions {
  saved: boolean;
  worn: boolean;
  /** "Bugün giydim" exists only for an outfit that is about today (the backend records the wear for today). */
  canWear: boolean;
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
  const wear = useWear();
  const personaId = useActivePersona()?.id;

  return {
    saved: outfit.savedAt !== null,
    worn: outfit.wornAt !== null,
    canWear: canWearOutfit(outfit),
    saving: save.isPending,
    wearing: wear.wearing,
    save: () => {
      track('outfit_feedback', { action: 'Save' });
      save.mutate(outfit.id, {
        onSuccess: () => showToast(tr.outfitSavedToast),
        onError: () => showToast(tr.outfitActionFailed),
      });
    },
    wear: () => wear.wear(outfit.id),
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
