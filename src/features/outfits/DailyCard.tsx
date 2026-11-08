import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
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
 * The black outfit card (design screen 02) on Keşfet and on top of Dolap: today's outfit until noon ("Bugün için"),
 * tomorrow's after it ("Yarın için"), or the prompt to fill the wardrobe. It opens the daily screen on the very outfit
 * it shows (same date and seed, so the same query).
 */
/** `flush` drops the side margin, for a parent that already pads its content (Dolap). */
export function DailyCard({ flush = false }: { flush?: boolean }) {
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
      <View style={[styles.card, flush && styles.cardFlush]} testID="tomorrow-prompt">
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title}>{tr.homeCardPromptTitle}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/wardrobe')}
          style={styles.promptButton}
          testID="tomorrow-add"
        >
          <Text style={styles.promptButtonText}>{tr.homeCardPromptCta}</Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'loading' || daily.isPending) {
    return (
      <View style={[styles.card, flush && styles.cardFlush]} testID="tomorrow-loading">
        <Text style={styles.label}>{label}</Text>
        <Skeleton height={theme.sizes.homeCardThumbHeight} radius={theme.radius.lg} />
      </View>
    );
  }

  const outfit = daily.data?.outfit ?? null;
  const weather = daily.data?.weather ?? null;
  const weatherText = weather
    ? `${toNumber(weather.temperatureC)}° · ${weatherLabel(weather).replace(/^./u, (first) => first.toLocaleUpperCase('tr-TR'))}`
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.homeCardCta}
      onPress={() =>
        router.push({
          pathname: '/outfits/daily',
          params: { date: day, seed: String(CARD_SEED) },
        })
      }
      style={[styles.card, flush && styles.cardFlush]}
      testID="tomorrow-card"
    >
      <View style={styles.top}>
        <View style={styles.topText}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.title}>{outfit ? tr.discoverTomorrowTitle : tr.homeCardNothing}</Text>
        </View>
        {weatherText ? (
          <View style={styles.weather} testID="tomorrow-weather">
            <Text style={styles.weatherText}>{weatherText}</Text>
          </View>
        ) : null}
      </View>
      {outfit ? (
        <OutfitCollage pieces={outfit.pieces} layout="row" testID="tomorrow-collage" />
      ) : null}
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{tr.homeCardCta}</Text>
        <Icon name="arrowRight" size={20} color={theme.colors.onInk} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Inside a list whose content is already padded (Dolap). */
  cardFlush: {
    marginHorizontal: 0,
  },
  card: {
    marginHorizontal: theme.screenPaddingX,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xxl,
    backgroundColor: theme.colors.ink,
    gap: theme.spacing.lg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  topText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.overline,
    color: theme.colors.borderStrong,
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.onInk,
  },
  weather: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  weatherText: {
    ...theme.typography.captionMedium,
    color: theme.colors.onInk,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.onInk,
  },
  promptButton: {
    alignSelf: 'flex-start',
    minHeight: theme.sizes.touch,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptButtonText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
});
