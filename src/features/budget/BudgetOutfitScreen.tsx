import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import type { BudgetOutfit, BudgetPiece } from '@/api/models';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { showToast } from '@/components/toastStore';
import { openOffer } from '@/features/catalog/buy';
import { OCCASIONS, outfitSubtitle } from '@/features/outfits/labels';
import { OutfitFrame } from '@/features/outfits/OutfitFrame';
import { useDismissOutfit, useSaveOutfit } from '@/features/outfits/hooks';
import { DismissSheet, type DismissReason } from '@/features/outfits/OutfitSheet';
import { useActivePersona } from '@/features/personas/hooks';
import { useWardrobeStats } from '@/features/wardrobe/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';
import { theme } from '@/theme';
import { formatTry } from '@/utils/money';

import { BudgetOutfitSection } from './BudgetOutfitSection';
import { BudgetSheet } from './BudgetSheet';
import {
  EMPTY_BUDGET_FORM,
  budgetBand,
  budgetResult,
  dateLabel,
  toAsk,
  wardrobeHasShoes,
  type BudgetAsk,
  type BudgetForm,
} from './form';
import { useBudgetOutfits } from './hooks';

/** The backend accepts a seed up to this; the next one after it starts again. */
const MAX_SEED = 1000;

interface Submitted {
  form: BudgetForm;
  /** The style that was active when the sheet was submitted; it is part of the request. */
  personaId?: string;
}

/** An outfit has an id only when it is stored (signed in); a visitor's is told apart by its pieces. */
function outfitKey(outfit: BudgetOutfit): string {
  return outfit.id ?? outfit.pieces.map((piece) => `${piece.slot}:${piece.name}`).join('|');
}

/** "3.000 ₺ · Ofis · Bugün": what the answer on screen was asked for. */
function summaryOf(ask: BudgetAsk): string {
  const occasion = OCCASIONS.find((entry) => entry.value === ask.occasion)?.label;
  return [formatTry(ask.budget), occasion, dateLabel(ask.date, new Date())]
    .filter(Boolean)
    .join(' · ');
}

/**
 * "Bütçene göre kombin": the sheet asks for an amount, the screen answers with up to three outfits that fit it. A
 * visitor gets the same screen with the audience asked instead of the wardrobe. Every state has a way forward: the
 * amount can always be changed, and a failed request can be retried.
 */
export function BudgetOutfitScreen() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  const personaId = useActivePersona()?.id;
  const stats = useWardrobeStats();
  const hasShoes = wardrobeHasShoes(stats.data);

  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [seed, setSeed] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetKey, setSheetKey] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [dismissing, setDismissing] = useState<BudgetOutfit | null>(null);

  const ask = submitted
    ? toAsk(submitted.form, { signedIn: isSignedIn, personaId: submitted.personaId, seed })
    : null;
  const query = useBudgetOutfits(ask);
  const data = query.data;
  const save = useSaveOutfit();
  const dismiss = useDismissOutfit();

  // One `budget_outfit_view` per answer, counted once its first copy is on screen (not the old outfits a shuffle keeps).
  const viewed = useRef<string | null>(null);
  const answered = data !== undefined && !query.isPlaceholderData;
  const askKey = ask ? JSON.stringify(ask) : null;
  useEffect(() => {
    if (!answered || !data || !ask || viewed.current === askKey) {
      return;
    }
    viewed.current = askKey;
    track('budget_outfit_view', {
      budgetBand: budgetBand(ask.budget),
      outfitCount: data.outfits.length,
      result: budgetResult(data, ask),
      ...(ask.occasion ? { occasion: ask.occasion } : {}),
    });
    // `ask` and `data` are what `askKey` and `answered` stand for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, askKey]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openSheet = () => {
    setSheetKey((key) => key + 1);
    setSheetOpen(true);
  };

  const submit = (form: BudgetForm) => {
    setSubmitted({ form, personaId });
    setSeed(0);
    setHidden([]);
    setSheetOpen(false);
  };

  const shuffle = () => {
    const next = (seed + 1) % (MAX_SEED + 1);
    track('budget_outfit_shuffle', { seed: next });
    setSeed(next);
    setHidden([]);
  };

  const saveOutfit = (outfit: BudgetOutfit) => {
    if (!outfit.id) {
      // A visitor's outfit is not stored: saving asks to sign in first.
      router.push('/login');
      return;
    }
    track('outfit_feedback', { action: 'Save' });
    save.mutate(outfit.id, {
      onSuccess: () => {
        setSavedKeys((keys) => [...keys, outfitKey(outfit)]);
        showToast(tr.outfitSavedToast);
      },
      onError: () => showToast(tr.outfitActionFailed),
    });
  };

  const dismissOutfit = (outfit: BudgetOutfit, reason: DismissReason | null) => {
    setDismissing(null);
    setHidden((keys) => [...keys, outfitKey(outfit)]);
    if (reason === null) {
      return;
    }
    track('outfit_feedback', { action: 'Dismiss', reason });
    if (outfit.id) {
      dismiss.mutate(
        { id: outfit.id, reason },
        { onError: () => showToast(tr.outfitActionFailed) },
      );
    }
  };

  const buy = (piece: BudgetPiece) => {
    if (!piece.offer) {
      return;
    }
    void openOffer(
      { id: piece.offer.offerId, goPath: piece.offer.goPath },
      { source: 'budget', personaId: isSignedIn ? personaId : undefined },
    );
  };

  const visible = (data?.outfits ?? []).filter((outfit) => !hidden.includes(outfitKey(outfit)));

  let content: ReactElement;
  if (!ask) {
    content = (
      <EmptyState
        title={tr.budgetIdleTitle}
        body={tr.budgetIdleBody}
        action={{ label: tr.budgetIdleAction, onPress: openSheet }}
      />
    );
  } else if (query.isPending) {
    content = (
      <View style={styles.padded} testID="budget-loading">
        <Text style={styles.loadingText}>{tr.budgetLoading}</Text>
        <Skeleton height={theme.sizes.outfitFigureSkeleton} radius={theme.radius.panel} />
      </View>
    );
  } else if (!data) {
    content = (
      <ErrorState
        title={tr.budgetLoadFailed}
        body={
          query.error instanceof ApiError && query.error.isNetworkError
            ? tr.errorNetwork
            : undefined
        }
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (data.outfits.length === 0) {
    content = (
      <EmptyState
        title={tr.budgetEmptyTitle}
        body={data.message ?? tr.budgetEmptyBody}
        action={{ label: tr.budgetIncrease, onPress: openSheet }}
      />
    );
  } else if (visible.length === 0) {
    content = <EmptyState title={tr.budgetNoMoreTitle} body={tr.budgetNoMoreBody} />;
  } else {
    // An over-budget outfit carries its own mark and action, so the message would only say the same twice.
    const banner = data.message && !data.overBudget ? data.message : null;
    content = (
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        testID="budget-list"
      >
        {banner ? <Banner message={banner} onIncrease={openSheet} /> : null}
        {visible.map((outfit, index) => (
          <View key={outfitKey(outfit)} style={styles.item}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <BudgetOutfitSection
              outfit={outfit}
              signedIn={isSignedIn}
              saved={savedKeys.includes(outfitKey(outfit))}
              saving={save.isPending && save.variables === outfit.id}
              onSave={() => saveOutfit(outfit)}
              onDismiss={() => setDismissing(outfit)}
              onIncrease={openSheet}
              onBuy={buy}
              onAddSize={() => router.push('/profile/sizes')}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  const summary = ask ? summaryOf(ask) : null;
  const controls = summary ? (
    <View style={styles.controls}>
      <Chip
        label={summary}
        accessibilityLabel={`${tr.budgetChange}: ${summary}`}
        dropdown
        onPress={openSheet}
        testID="budget-summary"
      />
    </View>
  ) : undefined;

  const shuffleButton =
    data && data.outfits.length > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: query.isPlaceholderData }}
        disabled={query.isPlaceholderData}
        onPress={shuffle}
        style={[styles.shuffle, query.isPlaceholderData && styles.shuffleBusy]}
        testID="budget-shuffle"
      >
        <Icon name="shuffle" size={16} />
        <Text style={styles.shuffleText}>{tr.budgetShuffle}</Text>
      </Pressable>
    ) : undefined;

  return (
    <>
      <OutfitFrame
        title={tr.budgetTitle}
        subtitle={outfitSubtitle(data?.weather ?? null, undefined)}
        onClose={close}
        right={shuffleButton}
        controls={controls}
      >
        {content}
      </OutfitFrame>
      <BudgetSheet
        key={sheetKey}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={submitted?.form ?? EMPTY_BUDGET_FORM}
        signedIn={isSignedIn}
        hasShoes={hasShoes}
        onSubmit={submit}
      />
      <DismissSheet
        visible={dismissing !== null}
        onReason={(reason) => dismissing && dismissOutfit(dismissing, reason)}
        onJustClose={() => dismissing && dismissOutfit(dismissing, null)}
        onCancel={() => setDismissing(null)}
      />
    </>
  );
}

/** The backend's sentence about this answer (the budget did not reach the shoes), with the way out. */
function Banner({ message, onIncrease }: { message: string; onIncrease: () => void }) {
  return (
    <View style={styles.banner} testID="budget-banner">
      <Text style={styles.bannerText}>{message}</Text>
      <Button
        label={tr.budgetIncrease}
        variant="secondary"
        onPress={onIncrease}
        style={styles.bannerAction}
        testID="budget-banner-increase"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.md,
    alignItems: 'flex-start',
  },
  padded: {
    paddingHorizontal: theme.screenPaddingX,
    gap: theme.spacing.lg,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  list: {
    paddingHorizontal: theme.screenPaddingX,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.xl,
  },
  item: {
    gap: theme.spacing.xl,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
  },
  shuffle: {
    minHeight: theme.sizes.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.control,
    backgroundColor: theme.colors.bg,
  },
  shuffleBusy: {
    opacity: 0.4,
  },
  shuffleText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.ink,
  },
  // Kombin pointing at something: the surface panel with a chalk dashed edge, like the unlock card.
  banner: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.sizes.dashedBorder,
    borderStyle: 'dashed',
    borderColor: theme.colors.chalkLine,
  },
  bannerText: {
    ...theme.typography.body,
    color: theme.colors.ink2,
  },
  bannerAction: {
    alignSelf: 'flex-start',
  },
});
