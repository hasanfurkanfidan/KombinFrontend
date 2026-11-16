import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import type { Outfit } from '@/api/models';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Skeleton } from '@/components/Skeleton';
import { addPhotos } from '@/features/wardrobe/addItem';
import { useWardrobeStats } from '@/features/wardrobe/hooks';
import { pickPhotos } from '@/features/wardrobe/picker';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { usePrefsStore } from '@/session/prefsStore';
import { theme } from '@/theme';
import { toNumber } from '@/utils/money';

import { reportShuffle, useWear } from './actions';
import {
  HOME_CARD_SWITCH_HOUR,
  homeCardDay,
  homeCardPrimary,
  homeCardState,
  localDay,
  type HomeCardDay,
} from './homeCard';
import { useDailyOutfit } from './hooks';
import { OCCASIONS, occasionLabel, weatherLabel, type OccasionValue } from './labels';
import { OccasionSheet } from './OccasionSheet';
import { OutfitMiniFigure } from './OutfitMiniFigure';
import { initialSeedState, shuffleSeed } from './seeds';

/** From this font scale up the two buttons stack and the card grows; nothing is cut. */
const LARGE_TEXT_SCALE = 1.5;

/**
 * The outfit card on Keşfet (only there: the app shows it once; design screen 02). Today's outfit until it is marked
 * worn or 18:00, then tomorrow's; two actions on the card ("Bunu giyiyorum" and "Başka göster"), so the morning outfit
 * is settled in one tap. Tapping the figure or the title opens the daily screen on the very outfit it shows (same date,
 * seed and occasion, so the same query).
 */
export function DailyCard() {
  const { isSignedIn } = useSession();
  const stats = useWardrobeStats();
  const itemCount = stats.data ? toNumber(stats.data.itemCount) : undefined;
  const state = homeCardState({
    isSignedIn,
    itemCount,
    statsPending: isSignedIn && stats.isPending,
  });
  const wornDay = usePrefsStore((prefs) => prefs.homeCardWornDay);
  const markWorn = usePrefsStore((prefs) => prefs.markHomeCardWorn);

  // "Now" is read again whenever the app comes back to the front: a card left open overnight must not stay on
  // yesterday. The same moment ends the "Bugün giyiyorsun" state, which only confirms the tap.
  const [now, setNow] = useState(() => new Date());
  const [settledHere, setSettledHere] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(new Date());
        setSettledHere(false);
      }
    });
    return () => subscription.remove();
  }, []);

  // Is today's outfit already worn? Remembered when the user taps (the outfit they wore may not be seed 0), and read
  // from the plain seed-0 outfit in case the backend remembers it across launches.
  const beforeSwitch = now.getHours() < HOME_CARD_SWITCH_HOUR;
  const today = useDailyOutfit({ date: 'today', seed: 0 }, state === 'outfit' && beforeSwitch);
  const todayWorn = wornDay === localDay(now) || Boolean(today.data?.outfit?.wornAt);
  const day = settledHere ? 'today' : homeCardDay(now, todayWorn);

  if (state === 'prompt') {
    return <PromptCard day={day} />;
  }
  if (state === 'empty') {
    return <EmptyWardrobeCard day={day} />;
  }
  if (state === 'loading') {
    return <LoadingCard day={day} />;
  }
  return (
    <OutfitCard
      key={day}
      day={day}
      onWorn={() => {
        markWorn(localDay(now));
        setSettledHere(true);
      }}
    />
  );
}

function dayLabel(day: HomeCardDay): string {
  return day === 'today' ? tr.discoverTodayLabel : tr.discoverTomorrowLabel;
}

/** Signed out (or the piece count never came): the prompt to fill the wardrobe. */
function PromptCard({ day }: { day: HomeCardDay }) {
  const router = useRouter();
  return (
    <View style={styles.card} testID="tomorrow-prompt">
      <Text style={styles.label}>{dayLabel(day)}</Text>
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

/** First morning, nothing in the wardrobe yet: add photos at once, or look at what the shops would put together. */
function EmptyWardrobeCard({ day }: { day: HomeCardDay }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const addFromPhotos = async () => {
    const photos = await pickPhotos();
    if (photos.length > 0) {
      void addPhotos(queryClient, photos, 'library');
      // The cards and the confirm sheets live on the wardrobe tab.
      router.navigate('/wardrobe');
    }
  };

  return (
    <View style={styles.card} testID="home-empty">
      <Text style={styles.label}>{dayLabel(day)}</Text>
      <Text style={styles.title}>{tr.homeCardEmptyTitle}</Text>
      <View style={styles.emptyActions}>
        <Button
          label={tr.homeCardEmptyAdd}
          wrap
          onPress={() => void addFromPhotos()}
          testID="home-empty-add"
        />
        <Button
          label={tr.homeCardEmptyStore}
          variant="quiet"
          wrap
          style={styles.emptyLink}
          onPress={() =>
            router.push({ pathname: '/outfits/daily', params: { date: day, seed: '0' } })
          }
          testID="home-empty-store"
        />
      </View>
    </View>
  );
}

function LoadingCard({ day }: { day: HomeCardDay }) {
  return (
    <View style={styles.card} testID="tomorrow-loading">
      <Text style={styles.label}>{dayLabel(day)}</Text>
      <Skeleton height={theme.sizes.homeCardThumbHeight} radius={theme.radius.control} />
    </View>
  );
}

function titleFor(outfit: Pick<Outfit, 'completeness'> | null): string {
  if (!outfit) {
    return tr.homeCardNothing;
  }
  if (outfit.completeness === 'NeedsOne') {
    return tr.homeCardTitleNeedsOne;
  }
  return outfit.completeness === 'CatalogOnly' ? tr.homeCardTitleCatalog : tr.homeCardTitleComplete;
}

interface OutfitCardProps {
  day: HomeCardDay;
  /** The user marked today's outfit worn from this card. */
  onWorn: () => void;
}

function OutfitCard({ day, onWorn }: OutfitCardProps) {
  const router = useRouter();
  const large = useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
  const [seeds, setSeeds] = useState(() => initialSeedState());
  // Nothing is sent until the user chooses: the backend picks the occasion itself.
  const [occasion, setOccasion] = useState<OccasionValue | undefined>(undefined);
  const [choosing, setChoosing] = useState(false);
  const daily = useDailyOutfit({ date: day, occasion, seed: seeds.seed });
  const { wearing, wear } = useWear();

  if (daily.isPending) {
    return <LoadingCard day={day} />;
  }

  const outfit = daily.data?.outfit ?? null;
  const weather = daily.data?.weather ?? null;
  const weatherText = weather
    ? `${toNumber(weather.temperatureC)}° · ${weatherLabel(weather).replace(/^./u, (first) => first.toLocaleUpperCase('tr-TR'))}`
    : null;
  // The request is optimistic: the card settles on the tap and goes back to its actions if the call fails.
  const settled = day === 'today' && outfit !== null && (Boolean(outfit.wornAt) || wearing);
  const primary = homeCardPrimary(outfit, day);
  const chosenLabel = OCCASIONS.find((entry) => entry.value === occasion)?.label ?? null;
  const shownOccasion = chosenLabel ?? occasionLabel(outfit?.occasion ?? null);

  const open = () =>
    router.push({
      pathname: '/outfits/daily',
      params: {
        date: day,
        seed: String(seeds.seed),
        ...(occasion ? { occasion } : {}),
      },
    });

  const wearNow = () => {
    if (!outfit) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(tr.homeCardSettledAnnounce);
    wear(outfit.id, { quiet: true, onWorn });
  };

  const shuffle = () => {
    reportShuffle(outfit);
    setSeeds(shuffleSeed);
  };

  const choose = (value: OccasionValue | undefined) => {
    setOccasion(value);
    // A new occasion starts from the plain ranking.
    setSeeds(initialSeedState());
  };

  return (
    <View style={styles.card} testID="tomorrow-card">
      <View style={styles.top}>
        <View style={styles.topText}>
          <Text
            style={[styles.label, settled && styles.labelSettled]}
            accessibilityLiveRegion="polite"
            testID="home-card-label"
          >
            {settled ? tr.homeCardSettledLabel : dayLabel(day)}
          </Text>
          <Pressable accessibilityRole="button" onPress={open} testID="home-card-title">
            <Text style={styles.title}>{titleFor(outfit)}</Text>
          </Pressable>
          {weatherText ? (
            <View style={styles.weather} testID="tomorrow-weather">
              <Text style={styles.weatherText}>{weatherText}</Text>
            </View>
          ) : null}
          {settled ? (
            <Button
              label={tr.homeCardOpen}
              accessibilityLabel={tr.homeCardOpenLabel}
              variant="quiet"
              wrap
              trailingIcon="arrowRight"
              style={styles.link}
              onPress={open}
              testID="home-card-open"
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.homeCardOccasionLabel(shownOccasion)}
              onPress={() => setChoosing(true)}
              style={styles.occasion}
              testID="home-card-occasion"
            >
              <Text style={styles.occasionText}>
                <Text style={styles.occasionAsk}>{tr.homeCardOccasion(null)}</Text>
                {shownOccasion ? ` ${shownOccasion}` : ''}
              </Text>
              <Icon name="chevronDown" size={14} color={theme.colors.ink} />
            </Pressable>
          )}
        </View>
        {outfit ? (
          // The title and the "Kombini gör" button already name this action for a screen reader.
          <Pressable accessible={false} onPress={open} testID="home-card-figure">
            <OutfitMiniFigure pieces={outfit.pieces} testID="tomorrow-figure" />
          </Pressable>
        ) : null}
      </View>
      {settled ? null : (
        <View style={[styles.actions, large && styles.actionsLarge]}>
          <Button
            label={primary === 'wear' ? tr.homeCardWear : tr.homeCardOpen}
            accessibilityLabel={primary === 'wear' ? tr.homeCardWearLabel : tr.homeCardOpenLabel}
            wrap
            style={large ? undefined : styles.action}
            onPress={primary === 'wear' ? wearNow : open}
            testID={primary === 'wear' ? 'home-card-wear' : 'home-card-open'}
          />
          {outfit ? (
            <Button
              label={tr.homeCardShuffle}
              accessibilityLabel={tr.homeCardShuffleLabel}
              variant="secondary"
              wrap
              style={large ? undefined : styles.action}
              onPress={shuffle}
              testID="home-card-shuffle"
            />
          ) : null}
        </View>
      )}
      <OccasionSheet
        visible={choosing}
        value={occasion}
        onSelect={choose}
        onClose={() => setChoosing(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A surface panel with ink text, the small standing figure on the right. At the default text size it is at most 280
  // high in every state (see CLAUDE.md "Home card").
  card: {
    marginHorizontal: theme.screenPaddingX,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
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
  labelSettled: {
    color: theme.colors.primary,
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
  // "Nereye? Ofis ▾": plain text with a chevron, so it never looks like the "Tarzım: Ofis ▾" chip above the card.
  occasion: {
    alignSelf: 'flex-start',
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  occasionText: {
    ...theme.typography.label,
    flexShrink: 1,
    color: theme.colors.ink,
  },
  occasionAsk: {
    ...theme.typography.label,
    color: theme.colors.muted,
  },
  link: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionsLarge: {
    flexDirection: 'column',
  },
  action: {
    flex: 1,
  },
  emptyActions: {
    gap: theme.spacing.xs,
  },
  emptyLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
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
