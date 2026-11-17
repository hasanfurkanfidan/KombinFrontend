import { create } from 'zustand';

import { istanbulDay } from '@/utils/istanbulTime';

import {
  readStoredWornOutfit,
  writeStoredWornOutfit,
  type StoredWornOutfit,
} from './wornOutfitStorage';

/** How many recent searches the search screen keeps. */
export const MAX_RECENT_SEARCHES = 8;

/** The outfit marked worn, the account that did it and the Istanbul day (`yyyy-MM-dd`) it was for. */
export type HomeCardWorn = StoredWornOutfit;

interface PrefsState {
  /**
   * The user tapped "Atla" in onboarding. Kept in memory on purpose: a skipped onboarding is asked again on
   * the next launch (nothing was created, so there is nothing to lose), and no extra persistence is needed.
   */
  onboardingSkipped: boolean;
  /** Expo push token, once permission was granted; registered with the backend by `src/push`. Memory only. */
  pushToken: string | null;
  /** The contextual "notify me?" sheet was already shown this launch. */
  pushPromptShown: boolean;
  /**
   * The search screen's recent terms, newest first. Memory only, like the rest of this store: they last one launch,
   * which is enough for "what did I just look for" and keeps search terms off the disk.
   */
  recentSearches: string[];
  /**
   * The outfit the user marked worn today (`outfit.date` is today in Istanbul), so Keşfet's card stays on it as
   * "Bugün giyiyorsun" across restarts: the backend's daily endpoint does not return it, and the outfit worn may not be
   * the plain seed-0 one. **The one value of this store that is persisted** (a small file, see `wornOutfitStorage`;
   * not a secret); written only by `useWear` (its mutation's own `onSuccess`) and cleared when its day is over, when
   * the outfit is gone (404), when another account is signed in and when the session ends.
   */
  homeCardWorn: HomeCardWorn | null;
  /** The stored value has been read (or replaced) this launch; the card waits for it. */
  homeCardWornLoaded: boolean;
  skipOnboarding: () => void;
  setPushToken: (token: string | null) => void;
  markPushPromptShown: () => void;
  /** Moves `term` to the front (case-insensitive duplicates go) and keeps the newest eight. */
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  /** Remembers the worn outfit in memory and on disk. */
  markHomeCardWorn: (worn: HomeCardWorn) => void;
  /** Forgets it, in memory and on disk. */
  clearHomeCardWorn: () => void;
  /**
   * Reads the stored value once per launch, for the signed-in account (`userId`; `null` while it is unknown: nothing is
   * used and the file is left alone). A value of another account, a file from before the account was stored and a value
   * from a day before today (read from the clock now) are dropped and their file deleted; a value set while the read was
   * out, or a session that ended meanwhile, wins over the read.
   */
  hydrateHomeCardWorn: (userId: string | null) => Promise<void>;
  /**
   * Is the value's day over? Only a day **before** the real Istanbul day counts, read from the clock at this moment:
   * a value written just after midnight, while the card still holds the evening's `now`, is the new day's, not stale.
   */
  isHomeCardWornStale: (worn: HomeCardWorn) => boolean;
  reset: () => void;
}

const initial = {
  onboardingSkipped: false,
  pushToken: null,
  pushPromptShown: false,
  recentSearches: [] as string[],
  homeCardWorn: null as HomeCardWorn | null,
};

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ...initial,
  homeCardWornLoaded: false,
  skipOnboarding: () => set({ onboardingSkipped: true }),
  setPushToken: (pushToken) => set({ pushToken }),
  markPushPromptShown: () => set({ pushPromptShown: true }),
  addRecentSearch: (term) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLocaleLowerCase('tr');
    set((state) => ({
      recentSearches: [
        trimmed,
        ...state.recentSearches.filter((recent) => recent.toLocaleLowerCase('tr') !== key),
      ].slice(0, MAX_RECENT_SEARCHES),
    }));
  },
  clearRecentSearches: () => set({ recentSearches: [] }),
  markHomeCardWorn: (worn) => {
    set({ homeCardWorn: worn, homeCardWornLoaded: true });
    void writeStoredWornOutfit(worn);
  },
  clearHomeCardWorn: () => {
    set({ homeCardWorn: null, homeCardWornLoaded: true });
    void writeStoredWornOutfit(null);
  },
  isHomeCardWornStale: (worn) => worn.day < istanbulDay(new Date()),
  hydrateHomeCardWorn: async (userId) => {
    if (get().homeCardWornLoaded) {
      return;
    }
    const stored = await readStoredWornOutfit();
    // Something was marked (or the session was reset) while the file was being read: that is newer.
    if (get().homeCardWornLoaded) {
      return;
    }
    if (userId === null) {
      // Who is signed in is not known (yet): use nothing, and keep the file for the next launch.
      set({ homeCardWorn: null, homeCardWornLoaded: true });
      return;
    }
    if (stored && stored.userId === userId && !get().isHomeCardWornStale({ ...stored, userId })) {
      set({
        homeCardWorn: { userId, day: stored.day, outfitId: stored.outfitId },
        homeCardWornLoaded: true,
      });
      return;
    }
    if (stored) {
      void writeStoredWornOutfit(null);
    }
    set({ homeCardWorn: null, homeCardWornLoaded: true });
  },
  reset: () => {
    // Nothing left to read after a reset: the file goes too, and the card need not wait for it.
    void writeStoredWornOutfit(null);
    set({ ...initial, homeCardWornLoaded: true });
  },
}));
