import { StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { getProfile } from '@/api/endpoints/profile';
import type { StyleSummary } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Skeleton } from '@/components/Skeleton';
import { prefetchProducts } from '@/features/catalog/hooks';
import { withPersona } from '@/features/catalog/filters';
import { usePersonas } from '@/features/personas/hooks';
import { swatchColor } from '@/features/personas/swatches';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { styleFamilyLabels } from './labels';

const SCALE_DOTS = 5;

interface DoneScreenProps {
  personaId: string;
}

/** Step 4: what the swipes taught us (top colours, formality, families), then on to Keşfet. */
export function DoneScreen({ personaId }: DoneScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const personas = usePersonas();
  const persona = personas.data?.find((item) => item.id === personaId);

  const goToDiscover = () => {
    // Warm what Keşfet opens with, so it renders from cache: the profile and the first page of the scored list.
    void queryClient.prefetchQuery({
      queryKey: queryKeys.profile,
      queryFn: ({ signal }) => getProfile(signal),
    });
    void prefetchProducts(queryClient, withPersona({}, personaId));
    router.replace('/');
  };

  return (
    <View style={styles.root}>
      <View style={styles.titles}>
        <Text style={styles.title}>{tr.onboardingDoneTitle}</Text>
        <Text style={styles.subtitle}>{tr.onboardingDoneSubtitle}</Text>
      </View>

      {persona ? (
        <SummaryCard summary={persona.styleSummary} />
      ) : (
        <Skeleton height={180} radius={theme.radius.xl} />
      )}

      <Button label={tr.onboardingDoneCta} onPress={goToDiscover} testID="done-cta" />
    </View>
  );
}

function SummaryCard({ summary }: { summary: StyleSummary }) {
  const hasTaste = summary.topColors.length > 0 || summary.topFamilies.length > 0;
  const formality = Math.min(SCALE_DOTS, Math.max(1, Math.round(toNumber(summary.formalityMean))));

  if (!hasTaste) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>{tr.onboardingDoneEmpty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="style-summary">
      <View style={styles.block}>
        <Text style={styles.blockLabel}>{tr.onboardingDoneColors}</Text>
        <View style={styles.swatches}>
          {summary.topColors.map((name) => (
            <View
              key={name}
              accessibilityLabel={name}
              style={[styles.swatch, { backgroundColor: swatchColor(name) }]}
              testID={`summary-swatch-${name}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{tr.onboardingDoneFormality}</Text>
        <View style={styles.scaleRow}>
          <Text style={styles.scaleEnd}>{tr.onboardingDoneFormalityLow}</Text>
          <View style={styles.dots} testID="formality-scale">
            {Array.from({ length: SCALE_DOTS }, (_, position) => (
              <View
                key={position}
                style={[styles.dot, position < formality ? styles.dotOn : styles.dotOff]}
              />
            ))}
          </View>
          <Text style={styles.scaleEnd}>{tr.onboardingDoneFormalityHigh}</Text>
        </View>
      </View>

      {summary.topFamilies.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>{tr.onboardingDoneFamilies}</Text>
          <View style={styles.families}>
            {summary.topFamilies.map((family) => (
              <Chip
                key={family}
                label={
                  Object.hasOwn(styleFamilyLabels, family)
                    ? styleFamilyLabels[family as keyof typeof styleFamilyLabels]
                    : family
                }
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: theme.screenPaddingX,
    paddingTop: theme.spacing.xxxl * 2,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.xxl,
    backgroundColor: theme.colors.surface,
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
  card: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  empty: {
    ...theme.typography.body,
    color: theme.colors.inkSoft,
  },
  block: {
    gap: theme.spacing.sm,
  },
  blockLabel: {
    ...theme.typography.overline,
    color: theme.colors.inkMuted,
  },
  swatches: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  scaleEnd: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
  },
  dots: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: theme.radius.pill,
  },
  dotOn: {
    backgroundColor: theme.colors.ink,
  },
  dotOff: {
    backgroundColor: theme.colors.surfaceAlt2,
  },
  families: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
});
