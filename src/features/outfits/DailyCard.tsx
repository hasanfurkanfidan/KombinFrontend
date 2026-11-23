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

import { ApiError } from '@/api/client';
import type { Outfit } from '@/api/models';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Skeleton } from '@/components/Skeleton';
import { AskFriendButton } from '@/features/askFriend/AskFriendButton';
import { LeagueEntryLine } from '@/features/league/LeagueEntryLine';
import { useMe } from '@/features/profile/hooks';
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
  homeCardDay,
  homeCardPrimary,
  homeCardState,
  wornToday,
  type HomeCardDay,
} from './homeCard';
import { useDailyOutfit, useOutfit } from './hooks';
import { OCCASIONS, occasionLabel, weatherLabel, type OccasionValue } from './labels';
import { OccasionSheet } from './OccasionSheet';
import { OutfitMiniFigure } from './OutfitMiniFigure';
import { initialSeedState, shuffleSeed } from './seeds';

/** From this font scale up the two buttons stack and the card grows; nothing is cut. */
const LARGE_TEXT_SCALE = 1.5;

/**
 * The outfit card on Keşfet (only there: the app shows it once; design screen 02). Today's outfit until 18:00 Istanbul
 * time (whatever zone the phone is set to), then tomorrow's; two actions on the card ("Bunu giyiyorum" and "Başka göster"), so the morning outfit is settled in one
 * tap. Tapping the figure or the title opens the daily screen on the very outfit it shows (same date, seed and
 * occasion, so the same query).
 *
 * Once today's outfit is worn the card stays on it, settled ("Bugün giyiyorsun"), until 18:00, also after a restart:
 * the worn outfit's id is remembered (`prefsStore.homeCardWorn`, per account) and loaded by id, because the daily
 * endpoint does not return it and it may not be the plain seed-0 outfit.
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
  const storedWorn = usePrefsStore((prefs) => prefs.homeCardWorn);
  const wornLoaded = usePrefsStore((prefs) => prefs.homeCardWornLoaded);

  // "Now" is read again whenever the app comes back to the front: a card left open overnight must not stay on
  // yesterday, and the evening switch to tomorrow happens without a restart.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(new Date());
      }
    });
    return () => subscription.remove();
  }, []);

  const day = homeCardDay(now);

  // The remembered outfit is kept per account: read it once per launch, once the account is known (`GET /me`). If the
  // account cannot be looked up, the card goes on without it rather than wait for ever.
  const me = useMe();
  const userId = me.data?.id ?? null;
  const meFailed = me.isError;
  useEffect(() => {
    if (isSignedIn && (userId !== null || meFailed)) {
      void usePrefsStore.getState().hydrateHomeCardWorn(userId);
    }
  }, [isSignedIn, userId, meFailed]);
  // Another account's value never shows, whatever is in memory.
  const worn = storedWorn !== null && storedWorn.userId === userId ? storedWorn : null;
  // Over only when its day is before the real Istanbul day, read now: the card's own `now` may be hours old.
  const staleWorn = worn !== null && usePrefsStore.getState().isHomeCardWornStale(worn);
  useEffect(() => {
    if (staleWorn) {
      usePrefsStore.getState().clearHomeCardWorn();
    }
  }, [staleWorn]);

  if (state === 'prompt') {
    return <PromptCard day={day} />;
  }
  if (state === 'empty') {
    return <EmptyWardrobeCard day={day} />;
  }
  if (state === 'loading' || (day === 'today' && !wornLoaded)) {
    return <LoadingCard day={day} />;
  }
  if (day === 'today' && worn && !staleWorn) {
    return <WornOutfitCard outfitId={worn.outfitId} />;
  }
  return <OutfitCard key={day} day={day} />;
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

function weatherTag(weather: Outfit['weather']): string | null {
  return weather
    ? `${toNumber(weather.temperatureC)}° · ${weatherLabel(weather).replace(/^./u, (first) => first.toLocaleUpperCase('tr-TR'))}`
    : null;
}

interface SettledCardProps {
  /** `null` while the outfit is on its way (or could not be loaded): the frame stays, without a figure. */
  outfit: Outfit | null;
  onOpen: () => void;
}

/**
 * "Bugün giyiyorsun": the label in green, the title, the weather, the figure and one quiet "Kombini gör"; no actions
 * and no occasion control. The same frame for an outfit worn from this card (before the answer is in) and one loaded by
 * its remembered id.
 */
function SettledCard({ outfit, onOpen }: SettledCardProps) {
  const weatherText = weatherTag(outfit?.weather ?? null);
  return (
    <View style={styles.card} testID="tomorrow-card">
      <View style={styles.top}>
        <View style={styles.topText}>
          <Text
            style={[styles.label, styles.labelSettled]}
            accessibilityLiveRegion="polite"
            testID="home-card-label"
          >
            {tr.homeCardSettledLabel}
          </Text>
          <LeagueEntryLine />
          <Pressable accessibilityRole="button" onPress={onOpen} testID="home-card-title">
            <Text style={styles.title}>{outfit ? titleFor(outfit) : tr.homeCardTitleComplete}</Text>
          </Pressable>
          {weatherText ? (
            <View style={styles.weather} testID="tomorrow-weather">
              <Text style={styles.weatherText}>{weatherText}</Text>
            </View>
          ) : null}
          <Button
            label={tr.homeCardOpen}
            accessibilityLabel={tr.homeCardOpenLabel}
            variant="quiet"
            wrap
            trailingIcon="arrowRight"
            style={styles.link}
            onPress={onOpen}
            testID="home-card-open"
          />
        </View>
        {outfit ? (
          // The title and the "Kombini gör" button already name this action for a screen reader.
          <Pressable accessible={false} onPress={onOpen} testID="home-card-figure">
            <OutfitMiniFigure pieces={outfit.pieces} testID="tomorrow-figure" />
          </Pressable>
        ) : (
          <Skeleton height={theme.sizes.homeCardThumbHeight} radius={theme.radius.control} />
        )}
      </View>
    </View>
  );
}

/**
 * Today's worn outfit after a restart (or after the tap, once the backend answered): loaded by its id, settled from
 * the first frame. While it loads, and if the load fails for a reason other than "gone", the settled frame stays
 * (never the "Bunu giyiyorum" actions); a 404 means the outfit no longer exists, so the remembered value is dropped and
 * the normal card takes over.
 */
function WornOutfitCard({ outfitId }: { outfitId: string }) {
  const router = useRouter();
  const query = useOutfit(outfitId);
  const gone = query.error instanceof ApiError && query.error.status === 404;
  useEffect(() => {
    if (gone) {
      usePrefsStore.getState().clearHomeCardWorn();
    }
  }, [gone]);

  if (gone) {
    // One frame until the store update re-renders the parent: nothing to show for a missing outfit.
    return <LoadingCard day="today" />;
  }
  return (
    <SettledCard
      outfit={query.data ?? null}
      onOpen={() => router.push({ pathname: '/outfits/[id]', params: { id: outfitId } })}
    />
  );
}

function OutfitCard({ day }: { day: HomeCardDay }) {
  const router = useRouter();
  const large = useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
  const [seeds, setSeeds] = useState(() => initialSeedState());
  // Nothing is sent until the user chooses: the backend picks the occasion itself.
  const [occasion, setOccasion] = useState<OccasionValue | undefined>(undefined);
  const [choosing, setChoosing] = useState(false);
  const daily = useDailyOutfit({ date: day, occasion, seed: seeds.seed });
  const { wear } = useWear();
  // The outfit the user tapped "Bunu giyiyorum" on. The settled card shows **that** one while the request runs and after
  // it answers, whatever the daily query holds by then (a shuffle that lands, a refetch).
  const [tapped, setTapped] = useState<Outfit | null>(null);

  if (daily.isPending) {
    return <LoadingCard day={day} />;
  }

  const outfit = daily.data?.outfit ?? null;
  const weather = daily.data?.weather ?? null;
  const weatherText = weatherTag(weather);
  // While the next outfit of a shuffle is on its way, the card still shows the old one: nothing may be done to it.
  const busy = daily.isPlaceholderData;
  // The request is optimistic: the card settles on the tap and goes back to its actions if the call fails. Otherwise it
  // is settled only by an outfit that is about today and was worn today.
  const settledOutfit =
    tapped ?? (day === 'today' && outfit !== null && wornToday(outfit) ? outfit : null);
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
    if (!outfit || busy) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(tr.homeCardSettledAnnounce);
    setTapped(outfit);
    wear(outfit.id, { quiet: true, onError: () => setTapped(null) });
  };

  if (settledOutfit) {
    const settledId = settledOutfit.id;
    return (
      <SettledCard
        outfit={settledOutfit}
        onOpen={
          tapped
            ? () => router.push({ pathname: '/outfits/[id]', params: { id: settledId } })
            : open
        }
      />
    );
  }

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
          <Text style={styles.label} testID="home-card-label">
            {dayLabel(day)}
          </Text>
          <Pressable accessibilityRole="button" onPress={open} testID="home-card-title">
            <Text style={styles.title}>{titleFor(outfit)}</Text>
          </Pressable>
          {weatherText ? (
            <View style={styles.weather} testID="tomorrow-weather">
              <Text style={styles.weatherText}>{weatherText}</Text>
            </View>
          ) : null}
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
        </View>
        {outfit ? (
          // The title and the "Kombini gör" button already name this action for a screen reader.
          <Pressable accessible={false} onPress={open} testID="home-card-figure">
            <OutfitMiniFigure pieces={outfit.pieces} testID="tomorrow-figure" />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.actions, large && styles.actionsLarge]}>
        <Button
          label={primary === 'wear' ? tr.homeCardWear : tr.homeCardOpen}
          accessibilityLabel={primary === 'wear' ? tr.homeCardWearLabel : tr.homeCardOpenLabel}
          wrap
          disabled={busy}
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
            disabled={busy}
            style={large ? undefined : styles.action}
            onPress={shuffle}
            testID="home-card-shuffle"
          />
        ) : null}
      </View>
      {outfit ? <AskFriendButton outfit={outfit} variant="quiet" wrap style={styles.ask} /> : null}
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
  ask: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
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
