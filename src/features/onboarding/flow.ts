import type { useRouter } from 'expo-router';

import { tr } from '@/i18n/tr';

/**
 * How the persona steps were reached:
 * - `first`: onboarding proper (audience → name → swipe → done), entered because the user has no persona yet.
 * - `new`: "+" on Keşfet or "Yeni tarz oluştur" on Profil (name → swipe), shown as a modal over the tabs.
 * - `retrain`: "Tarzını yeniden öğret" for an existing persona (swipe only).
 */
export type OnboardingFlow = 'first' | 'new' | 'retrain';

export function parseFlow(value: string | string[] | undefined): OnboardingFlow {
  const single = Array.isArray(value) ? value[0] : value;
  return single === 'new' || single === 'retrain' ? single : 'first';
}

/** Number of progress segments the header draws. */
export function stepCount(flow: OnboardingFlow): number {
  return flow === 'first' ? 4 : flow === 'new' ? 2 : 1;
}

type Router = ReturnType<typeof useRouter>;

/** Leaves the persona flow: back to the tabs (the first run replaces the stack, modals dismiss to where they started). */
export function leaveOnboarding(router: Router, flow: OnboardingFlow, returnTo?: string): void {
  if (flow === 'first') {
    router.replace('/');
  } else {
    router.dismissTo((returnTo as '/' | undefined) ?? '/');
  }
}

/** Presets offered as chips on the persona-name step; `key` is sent as the persona's `icon`. */
export const PERSONA_PRESETS = [
  { key: 'office', label: tr.personaPresetOffice },
  { key: 'weekend', label: tr.personaPresetWeekend },
  { key: 'night', label: tr.personaPresetNight },
  { key: 'sport', label: tr.personaPresetSport },
  { key: 'party', label: tr.personaPresetParty },
  { key: 'school', label: tr.personaPresetSchool },
] as const;

export const CUSTOM_PERSONA_ICON = 'custom';
