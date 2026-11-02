import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { track } from '@/analytics';
import { getStyleCards, submitSwipes } from '@/api/endpoints/profile';
import { queryKeys } from '@/api/queryKeys';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { leaveOnboarding, type OnboardingFlow } from './flow';
import { OnboardingFrame } from './OnboardingFrame';
import { SwipeDeck } from './SwipeDeck';
import { createSwipeOutbox } from './swipeOutbox';

/** Cards fetched for one persona: the design shows "n / 20". */
export const STYLE_CARD_LIMIT = 20;

interface SwipeScreenProps {
  personaId: string;
  flow: OnboardingFlow;
  returnTo?: string;
}

/** Step 3: the card stack. Swipes are queued and sent in batches; the style summary comes back with each batch. */
export function SwipeScreen({ personaId, flow, returnTo }: SwipeScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const finishing = useRef(false);

  const cards = useQuery({
    queryKey: queryKeys.styleCards(personaId),
    queryFn: ({ signal }) => getStyleCards(personaId, STYLE_CARD_LIMIT, signal),
    // The deck owns its cards while it is on screen: never swap them for a refetch, and never reuse a stale stack.
    staleTime: Infinity,
    gcTime: 0,
  });

  const finish = useCallback(
    async (flush: () => Promise<void>) => {
      if (finishing.current) {
        return;
      }
      finishing.current = true;
      await flush();
      // The style summary shown on the next screen and the match scores of Keşfet both depend on the swipes.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.personas }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productsAll }),
      ]);
      if (flow === 'first') {
        track('onboarding_step', { step: 'swipe', action: 'next' });
        router.replace({ pathname: '/done', params: { personaId } });
      } else {
        leaveOnboarding(router, flow, returnTo);
      }
    },
    [flow, personaId, queryClient, returnTo, router],
  );

  // The backend says so once it has seen enough likes to know the user's taste.
  const [tasteKnown, setTasteKnown] = useState(false);
  const [outbox] = useState(() =>
    createSwipeOutbox({
      send: (swipes) => submitSwipes(personaId, swipes),
      onResponse: (response) => {
        if (response.onboardingCompleted) {
          setTasteKnown(true);
        }
      },
    }),
  );

  // Only the first run moves on early (without showing the rest); a persona that is being re-trained
  // already counts as completed and keeps going until its cards run out.
  useEffect(() => {
    if (tasteKnown && flow === 'first') {
      void finish(() => outbox.flush());
    }
  }, [tasteKnown, flow, finish, outbox]);

  // Leaving the screen (back, skip, finish) must not lose queued swipes.
  useEffect(() => {
    return () => {
      void outbox.flush();
    };
  }, [outbox]);

  const items = cards.data?.items;

  return (
    <OnboardingFrame
      flow={flow}
      step={flow === 'first' ? 3 : flow === 'new' ? 2 : 1}
      title={tr.onboardingSwipeTitle}
      subtitle={tr.onboardingSwipeSubtitle}
      returnTo={returnTo}
    >
      {cards.isError ? (
        <ErrorState title={tr.onboardingSwipeLoadFailed} onRetry={() => void cards.refetch()} />
      ) : !items ? (
        <View style={styles.skeleton}>
          <Skeleton height={theme.sizes.swipeCardHeight} radius={theme.radius.xxl} />
        </View>
      ) : items.length === 0 ? (
        // Nothing left to show (e.g. every card was already swiped): move on.
        <EmptyDeck onDone={() => void finish(() => outbox.flush())} />
      ) : (
        <SwipeDeck
          cards={items}
          onSwipe={(card, decision) => {
            outbox.push({ styleCardId: card.id, decision });
            track('swipe', { personaId, decision });
          }}
          onFinish={() => void finish(() => outbox.flush())}
        />
      )}
    </OnboardingFrame>
  );
}

function EmptyDeck({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    onDone();
    // Runs once when the empty stack first renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

const styles = StyleSheet.create({
  skeleton: {
    alignSelf: 'stretch',
  },
});
