import { create } from 'zustand';

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
  skipOnboarding: () => void;
  setPushToken: (token: string | null) => void;
  markPushPromptShown: () => void;
  reset: () => void;
}

const initial = { onboardingSkipped: false, pushToken: null, pushPromptShown: false };

export const usePrefsStore = create<PrefsState>((set) => ({
  ...initial,
  skipOnboarding: () => set({ onboardingSkipped: true }),
  setPushToken: (pushToken) => set({ pushToken }),
  markPushPromptShown: () => set({ pushPromptShown: true }),
  reset: () => set(initial),
}));
