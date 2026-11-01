import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { useProfile } from '@/features/profile/hooks';
import { usePrefsStore } from '@/session/prefsStore';
import { useSession } from '@/session/useSession';
import { toNumber } from '@/utils/money';

/**
 * The onboarding entry rule: once a signed-in user's profile says `personaCount === 0`, the first screen they get
 * is the audience step instead of the tabs. It fires once per sign-in (not whenever the count changes later, e.g.
 * after archiving the last persona) and never after "Atla". Renders nothing.
 */
export function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const { isSignedIn } = useSession();
  const profile = useProfile();
  const skipped = usePrefsStore((state) => state.onboardingSkipped);
  const handled = useRef(false);
  const inOnboarding = (segments as string[])[0] === '(onboarding)';

  useEffect(() => {
    if (!isSignedIn) {
      handled.current = false;
      return;
    }
    if (handled.current || !profile.data) {
      return;
    }
    handled.current = true;
    if (toNumber(profile.data.personaCount) === 0 && !skipped && !inOnboarding) {
      router.replace('/audience');
    }
  }, [isSignedIn, profile.data, skipped, inOnboarding, router]);

  return null;
}
