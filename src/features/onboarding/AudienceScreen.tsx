import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { listPersonas } from '@/api/endpoints/profile';
import type { Audience } from '@/api/models';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { useCreatePersona } from '@/features/personas/hooks';
import { toUpdateRequest, useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { CUSTOM_PERSONA_ICON } from './flow';
import { OnboardingFrame } from './OnboardingFrame';

const CHOICES: { audience: Audience; label: string }[] = [
  { audience: 'Women', label: tr.onboardingAudienceWomen },
  { audience: 'Men', label: tr.onboardingAudienceMen },
  { audience: 'Unisex', label: tr.onboardingAudienceAll },
];

/**
 * Step 1 of 2: "Ne için alışveriş yapıyorsun?" → `PUT /me/profile { audience }`, then the style the cards will train
 * is created silently as "Tarzım" (no naming step: the user cannot answer it yet; Profil renames it) and the swipe
 * step opens.
 */
export function AudienceScreen() {
  const router = useRouter();
  const profile = useProfile();
  const update = useUpdateProfile();
  const createPersona = useCreatePersona();
  const [busy, setBusy] = useState(false);

  const choose = async (audience: Audience) => {
    if (!profile.data || busy) {
      return;
    }
    setBusy(true);
    try {
      await update.mutateAsync(toUpdateRequest(profile.data, { audience }));
      const personaId = await firstStyleId(() =>
        createPersona.mutateAsync({ name: tr.personaDefaultName, icon: CUSTOM_PERSONA_ICON }),
      );
      track('onboarding_step', { step: 'audience', action: 'next' });
      router.push({ pathname: '/swipe', params: { personaId, flow: 'first' } });
    } catch {
      showToast(tr.errorBody);
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingFrame
      flow="first"
      step={1}
      title={tr.onboardingAudienceTitle}
      subtitle={tr.onboardingAudienceSubtitle}
    >
      {profile.isError ? (
        <ErrorState onRetry={() => void profile.refetch()} />
      ) : (
        <View style={styles.cards}>
          {CHOICES.map(({ audience, label }) =>
            profile.data ? (
              <Pressable
                key={audience}
                accessibilityRole="button"
                accessibilityState={{ selected: profile.data.audience === audience }}
                disabled={busy}
                onPress={() => void choose(audience)}
                style={[
                  styles.card,
                  profile.data.audience === audience && styles.cardSelected,
                  busy && styles.cardBusy,
                ]}
                testID={`audience-${audience}`}
              >
                <Text style={styles.cardLabel}>{label}</Text>
              </Pressable>
            ) : (
              <Skeleton key={audience} height={96} radius={theme.radius.xl} />
            ),
          )}
        </View>
      )}
    </OnboardingFrame>
  );
}

/**
 * The style to train: a new "Tarzım", or the one already called so (a second run after going back, or a retry after
 * the create answered but the screen did not hear it).
 */
async function firstStyleId(create: () => Promise<{ id: string }>): Promise<string> {
  try {
    return (await create()).id;
  } catch (error) {
    if (error instanceof ApiError && error.errorCode === 'Profile.PersonaNameTaken') {
      const existing = (await listPersonas()).items.find(
        (persona) => persona.name === tr.personaDefaultName,
      );
      if (existing) {
        return existing.id;
      }
    }
    throw error;
  }
}

const styles = StyleSheet.create({
  cards: {
    gap: theme.spacing.md,
  },
  card: {
    height: 96,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  cardSelected: {
    borderColor: theme.colors.ink,
    borderWidth: 2,
  },
  cardBusy: {
    opacity: 0.6,
  },
  cardLabel: {
    ...theme.typography.headingLarge,
    color: theme.colors.ink,
  },
});
