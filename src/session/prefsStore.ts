import { create } from 'zustand';

/** How many recent searches the search screen keeps. */
export const MAX_RECENT_SEARCHES = 8;

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
  skipOnboarding: () => void;
  setPushToken: (token: string | null) => void;
  markPushPromptShown: () => void;
  /** Moves `term` to the front (case-insensitive duplicates go) and keeps the newest eight. */
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  reset: () => void;
}

const initial = {
  onboardingSkipped: false,
  pushToken: null,
  pushPromptShown: false,
  recentSearches: [] as string[],
};

export const usePrefsStore = create<PrefsState>((set) => ({
  ...initial,
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
  reset: () => set(initial),
}));
