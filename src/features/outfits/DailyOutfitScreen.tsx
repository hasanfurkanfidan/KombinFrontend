import { useState, type ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { track } from '@/analytics';
import type { DailyOutfit, Outfit } from '@/api/models';
import { recordOutfitFeedback } from '@/api/endpoints/outfits';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { useActivePersona } from '@/features/personas/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatTry, toNumber } from '@/utils/money';

import { useDailyOutfit, useDismissOutfit } from './hooks';
import {
  OCCASIONS,
  outfitSubtitle,
  outfitTitle,
  parseOccasion,
  type OccasionValue,
} from './labels';
import { NarrationRow, OutfitFrame } from './OutfitFrame';
import { OutfitPieces } from './OutfitPieces';
import { DismissSheet, OutfitPanel, type DismissReason } from './OutfitSheet';
import { initialSeedState, parseSeed, previousSeed, shuffleSeed } from './seeds';
import { useTrackOutfitView } from './tracking';

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function DailyOutfitScreen() {
  const { isSignedIn } = useSession();
  return isSignedIn ? <SignedInDaily /> : <SignedOutDaily />;
}

function SignedOutDaily() {
  const router = useRouter();
  return (
    <OutfitFrame
      title={tr.outfitViewTitle}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      <EmptyState
        title={tr.outfitSignedOutTitle}
        body={tr.outfitSignedOutBody}
        action={{ label: tr.profileSignIn, onPress: () => router.push('/login') }}
      />
    </OutfitFrame>
  );
}

function SignedInDaily() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; seed?: string; occasion?: string }>();
  const date = params.date || 'today';
  const persona = useActivePersona();
  const [occasion, setOccasion] = useState<OccasionValue | undefined>(
    parseOccasion(params.occasion),
  );
  const [seeds, setSeeds] = useState(() => initialSeedState(parseSeed(params.seed)));
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const daily = useDailyOutfit({ date, occasion, seed: seeds.seed });
  const dismiss = useDismissOutfit();

  const outfits = [daily.data?.outfit, ...(daily.data?.alternatives ?? [])].filter(
    (outfit): outfit is Outfit => Boolean(outfit) && !dismissed.includes(outfit?.id ?? ''),
  );
  const outfit = outfits[0];
  useTrackOutfitView(outfit);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const shuffle = () => {
    track('outfit_shuffle', {});
    if (outfit) {
      track('outfit_feedback', { action: 'Shuffle' });
      // The backend only records it; a failure changes nothing for the user.
      void recordOutfitFeedback(outfit.id, { action: 'Shuffle', reason: null }).catch(
        () => undefined,
      );
    }
    setSeeds(shuffleSeed);
    setDismissed([]);
  };

  const pickOccasion = (value: OccasionValue) => {
    setOccasion((current) => (current === value ? undefined : value));
    setSeeds(initialSeedState());
    setDismissed([]);
  };

  const sendReason = (reason: DismissReason) => {
    setAsking(false);
    if (!outfit) {
      return;
    }
    track('outfit_feedback', { action: 'Dismiss', reason });
    const id = outfit.id;
    setDismissed((current) => [...current, id]);
    dismiss.mutate({ id, reason }, { onError: () => showToast(tr.outfitActionFailed) });
  };

  // One row: "Nereye?" with the occasion chips, and the labelled shuffle on the right.
  const controls = (
    <View style={styles.controls}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        <Text style={styles.occasionLabel}>{tr.outfitOccasionLabel}</Text>
        {OCCASIONS.map((entry) => (
          <Chip
            key={entry.value}
            label={entry.label}
            selected={occasion === entry.value}
            onPress={() => pickOccasion(entry.value)}
            testID={`occasion-${entry.value}`}
          />
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={shuffle}
        style={styles.shuffle}
        testID="outfit-shuffle"
      >
        <Icon name="shuffle" size={16} />
        <Text style={styles.shuffleText}>{tr.outfitShuffle}</Text>
      </Pressable>
    </View>
  );

  const right =
    seeds.history.length > 0 ? (
      <IconButton
        icon="arrowLeft"
        label={tr.outfitPrevious}
        onPress={() => {
          setSeeds(previousSeed);
          setDismissed([]);
        }}
        testID="outfit-previous"
      />
    ) : null;

  const title = outfitTitle(outfit, daily.data?.outfit?.date ?? todayIso());
  const subtitle = outfitSubtitle(daily.data?.weather ?? null, persona?.name);

  let content: ReactElement;
  if (daily.isPending) {
    content = <DailySkeleton />;
  } else if (daily.isError) {
    content = <ErrorState title={tr.outfitLoadFailed} onRetry={() => void daily.refetch()} />;
  } else if (daily.data.wardrobeEmpty) {
    content = <EmptyWardrobe daily={daily.data} outfit={outfit} />;
  } else if (!outfit) {
    content = (
      <EmptyState
        title={dismissed.length > 0 ? tr.outfitNoMoreTitle : tr.outfitNothingTitle}
        body={
          dismissed.length > 0 ? tr.outfitNoMoreBody : (daily.data.message ?? tr.outfitNothingBody)
        }
      />
    );
  } else {
    content = <OutfitBody outfit={outfit} />;
  }

  return (
    <>
      <OutfitFrame
        title={title}
        subtitle={subtitle}
        onClose={() => (outfit && !daily.data?.wardrobeEmpty ? setAsking(true) : close())}
        right={right}
        controls={controls}
        sheet={
          outfit && !daily.data?.wardrobeEmpty ? (
            <OutfitPanel outfit={outfit} onSwipeDown={() => setAsking(true)} />
          ) : undefined
        }
      >
        {content}
      </OutfitFrame>
      <DismissSheet
        visible={asking}
        onReason={sendReason}
        onJustClose={() => {
          setAsking(false);
          close();
        }}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}

function OutfitBody({ outfit }: { outfit: Outfit }) {
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      testID="outfit-body"
    >
      <OutfitPieces pieces={outfit.pieces} />
      <NarrationRow text={outfit.narration.text} />
    </ScrollView>
  );
}

/** An empty wardrobe: the message, the shopping ideas ("Mağazadan", with their total) and the way to fill it. */
function EmptyWardrobe({ daily, outfit }: { daily: DailyOutfit; outfit: Outfit | undefined }) {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.emptyTitle}>{tr.outfitEmptyWardrobeTitle}</Text>
      <Text style={styles.emptyBody}>{daily.message ?? tr.outfitEmptyWardrobeBody}</Text>
      {outfit ? (
        <View style={styles.shopping} testID="shopping-outfit">
          <View style={styles.shoppingHeader}>
            <View style={styles.storePill}>
              <Text style={styles.storePillText}>{tr.outfitFromStore}</Text>
            </View>
            {outfit.totalPrice !== null ? (
              <Text style={styles.shoppingTotal}>
                {`${tr.outfitTotal} ${formatTry(toNumber(outfit.totalPrice))}`}
              </Text>
            ) : null}
          </View>
          <OutfitPieces pieces={outfit.pieces} shopping />
          <NarrationRow text={outfit.narration.text} />
        </View>
      ) : null}
      <Button
        label={tr.outfitFillWardrobe}
        onPress={() => router.navigate('/wardrobe')}
        testID="outfit-fill-wardrobe"
      />
    </ScrollView>
  );
}

function DailySkeleton() {
  return (
    <View style={styles.scroll} testID="outfit-skeleton">
      <View style={styles.skeletonRow}>
        <Skeleton height={160} radius={theme.radius.xxl} style={styles.skeletonCell} />
        <Skeleton height={160} radius={theme.radius.xxl} style={styles.skeletonCell} />
      </View>
      <View style={styles.skeletonRow}>
        <Skeleton height={160} radius={theme.radius.xxl} style={styles.skeletonCell} />
        <Skeleton height={160} radius={theme.radius.xxl} style={styles.skeletonCell} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingRight: theme.screenPaddingX,
    paddingBottom: theme.spacing.md,
  },
  chipScroll: {
    flex: 1,
  },
  chips: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingLeft: theme.screenPaddingX,
    paddingRight: theme.spacing.sm,
  },
  occasionLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  shuffle: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  shuffleText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  scroll: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  emptyTitle: {
    ...theme.typography.heading,
    color: theme.colors.ink,
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.inkMuted,
  },
  shopping: {
    gap: theme.spacing.md,
  },
  shoppingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storePill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  storePillText: {
    ...theme.typography.captionMedium,
    color: theme.colors.onInk,
  },
  shoppingTotal: {
    ...theme.typography.bodyStrong,
    color: theme.colors.ink,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  skeletonCell: {
    flex: 1,
    width: undefined,
  },
});
