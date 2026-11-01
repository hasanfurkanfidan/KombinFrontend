import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Audience } from '@/api/models';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { toUpdateRequest, useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { OnboardingFrame } from './OnboardingFrame';

const CHOICES: { audience: Audience; label: string }[] = [
  { audience: 'Women', label: tr.onboardingAudienceWomen },
  { audience: 'Men', label: tr.onboardingAudienceMen },
  { audience: 'Unisex', label: tr.onboardingAudienceAll },
];

/** Step 1: "Ne için alışveriş yapıyorsun?" → `PUT /me/profile { audience }`. */
export function AudienceScreen() {
  const router = useRouter();
  const profile = useProfile();
  const update = useUpdateProfile();

  const choose = (audience: Audience) => {
    if (!profile.data) {
      return;
    }
    update.mutate(toUpdateRequest(profile.data, { audience }), {
      onSuccess: () => router.push({ pathname: '/persona', params: { flow: 'first' } }),
      onError: () => showToast(tr.errorBody),
    });
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
                disabled={update.isPending}
                onPress={() => choose(audience)}
                style={[
                  styles.card,
                  profile.data.audience === audience && styles.cardSelected,
                  update.isPending && styles.cardBusy,
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
