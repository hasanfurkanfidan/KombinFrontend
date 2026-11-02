import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { Screen } from '@/components/Screen';
import { tr } from '@/i18n/tr';
import { usePrefsStore } from '@/session/prefsStore';
import { theme } from '@/theme';

import { leaveOnboarding, stepCount, type OnboardingFlow } from './flow';

/** Names of the first run's steps (1-based `step` indexes into this), as reported with `onboarding_step`. */
const FIRST_RUN_STEPS = ['audience', 'persona', 'swipe'] as const;

interface OnboardingFrameProps {
  flow: OnboardingFlow;
  /** 1-based position within the flow, for the progress dashes. */
  step: number;
  title: string;
  subtitle?: string;
  returnTo?: string;
  children: ReactNode;
}

/** Shared chrome of the persona steps: progress dashes, "Atla", title and subtitle. */
export function OnboardingFrame({
  flow,
  step,
  title,
  subtitle,
  returnTo,
  children,
}: OnboardingFrameProps) {
  const router = useRouter();
  const skipOnboarding = usePrefsStore((state) => state.skipOnboarding);
  const total = stepCount(flow);

  // Skipping creates nothing. In the first run it also stops the entry rule from asking again this launch.
  const skip = () => {
    if (flow === 'first') {
      track('onboarding_step', { step: FIRST_RUN_STEPS[step - 1] ?? 'swipe', action: 'skip' });
      skipOnboarding();
    }
    leaveOnboarding(router, flow, returnTo);
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.dashes} accessibilityLabel={`${step} / ${total}`}>
          {Array.from({ length: total }, (_, position) => (
            <View
              key={position}
              style={[styles.dash, position < step ? styles.dashDone : styles.dashTodo]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={skip}
          hitSlop={theme.spacing.md}
          style={styles.skip}
          testID="onboarding-skip"
        >
          <Text style={styles.skipText}>{tr.onboardingSkip}</Text>
        </Pressable>
      </View>
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  dashes: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  dash: {
    width: 32,
    height: 4,
    borderRadius: theme.radius.pill,
  },
  dashDone: {
    backgroundColor: theme.colors.ink,
  },
  dashTodo: {
    backgroundColor: theme.colors.surfaceAlt2,
  },
  skip: {
    minHeight: theme.sizes.touch,
    justifyContent: 'center',
  },
  skipText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.inkMuted,
  },
  titles: {
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
});
