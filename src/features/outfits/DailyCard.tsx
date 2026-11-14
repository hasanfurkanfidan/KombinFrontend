import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Skeleton } from '@/components/Skeleton';
import { useWardrobeStats } from '@/features/wardrobe/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { homeCardDay, homeCardState } from './homeCard';
import { useDailyOutfit } from './hooks';
import { weatherLabel } from './labels';
import { OutfitCollage } from './OutfitCollage';

/** The "Seed" the card and the daily screen share, so the screen opens on the very outfit the card shows. */
const CARD_SEED = 0;

/**
 * The black outfit card (design screen 02) on Keşfet (only there: the app shows it once): today's outfit until noon ("Bugün için"),
 * tomorrow's after it ("Yarın için"), or the prompt to fill the wardrobe. It opens the daily screen on the very outfit
 * it shows (same date and seed, so the same query).
 */
export function DailyCard() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const stats = useWardrobeStats();
  const itemCount = stats.data ? toNumber(stats.data.itemCount) : undefined;
  const state = homeCardState({
    isSignedIn,
    itemCount,
    statsPending: isSignedIn && stats.isPending,
  });
  const day = homeCardDay(new Date());
  const label = day === 'today' ? tr.discoverTodayLabel : tr.discoverTomorrowLabel;
  const daily = useDailyOutfit({ date: day, seed: CARD_SEED }, state === 'outfit');

  if (state === 'prompt') {
    return (
      <View style={styles.card} testID="tomorrow-prompt">
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title}>{tr.homeCardPromptTitle}</Text>
        <PressableScale
          accessibilityRole="button"
          onPress={() => router.navigate('/wardrobe')}
          style={styles.promptButton}
          testID="tomorrow-add"
        >
          <Text style={styles.promptButtonText}>{tr.homeCardPromptCta}</Text>
        </PressableScale>
      </View>
    );
  }

  if (state === 'loading' || daily.isPending) {
    return (
      <View style={styles.card} testID="tomorrow-loading">
        <Text style={styles.label}>{label}</Text>
        <Skeleton height={theme.sizes.homeCardThumbHeight} radius={theme.radius.control} />
      </View>
    );
  }

  const outfit = daily.data?.outfit ?? null;
  const weather = daily.data?.weather ?? null;
  const weatherText = weather
    ? `${toNumber(weather.temperatureC)}° · ${weatherLabel(weather).replace(/^./u, (first) => first.toLocaleUpperCase('tr-TR'))}`
    : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={tr.homeCardCta}
      onPress={() =>
        router.push({
          pathname: '/outfits/daily',
          params: { date: day, seed: String(CARD_SEED) },
        })
      }
      style={styles.card}
      testID="tomorrow-card"
    >
      <View style={styles.top}>
        <View style={styles.topText}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.title}>{outfit ? tr.discoverTomorrowTitle : tr.homeCardNothing}</Text>
          {weatherText ? (
            <View style={styles.weather} testID="tomorrow-weather">
              <Text style={styles.weatherText}>{weatherText}</Text>
            </View>
          ) : null}
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{tr.homeCardCta}</Text>
            <Icon name="arrowRight" size={18} color={theme.colors.primary} />
          </View>
        </View>
        {outfit ? (
          <OutfitCollage pieces={outfit.pieces} layout="figure" testID="tomorrow-collage" />
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Was a black card: now a surface panel with ink text, the small standing figure on the right.
  card: {
    marginHorizontal: theme.screenPaddingX,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.lg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.lg,
  },
  topText: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.typography.captionStrong,
    color: theme.colors.muted,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  weather: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.tag,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  weatherText: {
    ...theme.typography.captionMedium,
    fontVariant: ['tabular-nums'],
    color: theme.colors.ink2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  ctaText: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
  promptButton: {
    alignSelf: 'flex-start',
    minHeight: theme.sizes.touch,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptButtonText: {
    ...theme.typography.label,
    color: theme.colors.ink,
  },
});
