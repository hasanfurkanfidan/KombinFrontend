import { rotateAnonymousId } from '@/analytics';
import { queryClient } from '@/api/queryClient';
import { usePendingDeletionStore } from '@/features/auth/pendingDeletion';
import { resetImageUrls } from '@/features/social/imageUrl';
import { useAddStore } from '@/features/wardrobe/addStore';
import { purgeTempPhotos } from '@/utils/tempFiles';

import { usePrefsStore } from './prefsStore';
import { useSessionStore } from './sessionStore';

let epoch = 0;

/**
 * Grows by one every time a signed-in session ends. Background work that writes into the cache when it finishes (the
 * wardrobe and post polls) remembers the epoch it started in and stops quietly when it changed, so a poll for the
 * previous user can never land in the next user's cache.
 */
export function userScopeEpoch(): number {
  return epoch;
}

/**
 * Forgets everything that belongs to the account that just left this phone: every cached query and mutation (the
 * wardrobe, personas, outfits, saved products, alerts, notifications, posts with their per-viewer fields, creator
 * stats, blocks, and the scored catalog lists), the in-memory stores (recent searches, onboarding skip, push token
 * and prompt flag, the wardrobe add queue and its local photos, pending-deletion credentials), the post photo URL map,
 * the temporary photos on disk, and the anonymous analytics id.
 */
export function resetUserScopedState(): void {
  epoch += 1;
  void queryClient.cancelQueries();
  queryClient.clear();
  usePrefsStore.getState().reset();
  useAddStore.getState().reset();
  usePendingDeletionStore.getState().clear();
  resetImageUrls();
  void purgeTempPhotos();
  void rotateAnonymousId();
}

/**
 * Runs `resetUserScopedState` whenever the store leaves `signedIn` (sign-out, account deletion, a rejected refresh), and
 * forgets the remembered worn outfit when the start ends signed out.
 * Installed once at app start; returns the unsubscribe for tests.
 */
export function installUserScopeReset(): () => void {
  return useSessionStore.subscribe((state, previous) => {
    if (previous.status === 'signedIn' && state.status !== 'signedIn') {
      resetUserScopedState();
    } else if (previous.status === 'booting' && state.status === 'signedOut') {
      // Nobody is signed in after the start: the file of the last account on this phone has no owner to show it to.
      usePrefsStore.getState().clearHomeCardWorn();
    }
  });
}
