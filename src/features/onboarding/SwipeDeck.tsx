import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { StyleCard } from '@/api/models';
import { Icon } from '@/components/Icon';
import { tr } from '@/i18n/tr';
import { theme } from '@/theme';

import { styleFamilyLabels } from './labels';

export type SwipeDecision = 'Like' | 'Dislike' | 'Skip';

/** Horizontal drag (px) after which a release counts as a decision. */
const SWIPE_THRESHOLD = 110;
/** The LIKE/NOPE stamp starts to fade in at this share of the threshold. */
const STAMP_START = 0.4;
const MAX_ROTATION_DEG = 12;
const EXIT_MS = 200;

interface SwipeDeckProps {
  cards: readonly StyleCard[];
  /** Fired immediately for every decision, whether it came from a drag or a button. */
  onSwipe: (card: StyleCard, decision: SwipeDecision) => void;
  /** Fired once, after the last card has left. */
  onFinish: () => void;
}

/**
 * The swipe-onboarding card stack (design screen 01). Drag right to like, left to dislike; the three buttons below
 * do the same without a gesture (and are the accessible path). The decision is reported synchronously; the exit
 * animation is cosmetic and never gates the logic.
 */
export function SwipeDeck({ cards, onSwipe, onFinish }: SwipeDeckProps) {
  const { width } = useWindowDimensions();
  const cardWidth = width - theme.screenPaddingX * 2;
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<{
    key: number;
    card: StyleCard;
    decision: SwipeDecision;
    fromX: number;
  } | null>(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const finished = useRef(false);

  const current = cards[index];
  const next = cards[index + 1];

  const commit = useCallback(
    (decision: SwipeDecision, fromX = 0) => {
      if (!current) {
        return;
      }
      onSwipe(current, decision);
      setLeaving({ key: index, card: current, decision, fromX });
      setIndex(index + 1);
      translateX.set(0);
      translateY.set(0);
    },
    [current, index, onSwipe, translateX, translateY],
  );

  // The gesture runs on the UI thread and calls back through a stable function that reads the latest `commit`.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);
  const commitFromGesture = useCallback((decision: SwipeDecision, fromX: number) => {
    commitRef.current(decision, fromX);
  }, []);

  const pan = usePanGesture({
    onUpdate: (event) => {
      'worklet';
      translateX.set(event.translationX);
      translateY.set(event.translationY);
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.translationX > SWIPE_THRESHOLD) {
        scheduleOnRN(commitFromGesture, 'Like', event.translationX);
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        scheduleOnRN(commitFromGesture, 'Dislike', event.translationX);
      } else {
        translateX.set(withSpring(0));
        translateY.set(withSpring(0));
      }
    },
  });

  // Drop the exit-animation layer once it has played.
  useEffect(() => {
    if (!leaving) {
      return;
    }
    const timer = setTimeout(() => setLeaving(null), EXIT_MS + 50);
    return () => clearTimeout(timer);
  }, [leaving]);

  // Finish once the stack is empty and the last card has flown out.
  useEffect(() => {
    if (cards.length > 0 && index >= cards.length && !leaving && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [cards.length, index, leaving, onFinish]);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      {
        rotate: `${interpolate(
          translateX.get(),
          [-width / 2, 0, width / 2],
          [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));
  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.get(),
      [SWIPE_THRESHOLD * STAMP_START, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const nopeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.get(),
      [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * STAMP_START],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.root}>
      <View style={[styles.stack, { width: cardWidth }]}>
        {next ? (
          <View style={[styles.card, styles.behind, { width: cardWidth }]} pointerEvents="none">
            <CardFace card={next} />
          </View>
        ) : null}

        {current ? (
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[styles.card, { width: cardWidth }, topStyle]}
              testID={`swipe-card-${current.id}`}
            >
              <CardFace card={current} progress={{ current: index + 1, total: cards.length }} />
              <Animated.View style={[styles.stamp, styles.stampLike, likeStampStyle]}>
                <Text style={[styles.stampText, styles.stampTextLike]}>{tr.swipeStampLike}</Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.stampNope, nopeStampStyle]}>
                <Text style={[styles.stampText, styles.stampTextNope]}>{tr.swipeStampNope}</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        ) : null}

        {leaving ? (
          <LeavingCard
            key={leaving.key}
            card={leaving.card}
            decision={leaving.decision}
            fromX={leaving.fromX}
            width={cardWidth}
            screenWidth={width}
          />
        ) : null}
      </View>

      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.swipeDislike}
          onPress={() => commit('Dislike')}
          disabled={!current}
          style={[styles.button, styles.buttonLarge, styles.buttonOutline]}
          testID="swipe-dislike"
        >
          <Icon name="close" size={26} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.swipeSkip}
          onPress={() => commit('Skip')}
          disabled={!current}
          style={[styles.button, styles.buttonSmall, styles.buttonOutline]}
          testID="swipe-skip"
        >
          <Icon name="arrowRight" size={20} color={theme.colors.inkMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.swipeLike}
          onPress={() => commit('Like')}
          disabled={!current}
          style={[styles.button, styles.buttonLarge, styles.buttonLike]}
          testID="swipe-like"
        >
          <Icon name="heart" size={26} color={theme.colors.onInk} />
        </Pressable>
      </View>
    </View>
  );
}

function CardFace({
  card,
  progress,
}: {
  card: StyleCard;
  progress?: { current: number; total: number };
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.face}>
      {failed ? (
        <View style={styles.imageFallback}>
          <Icon name="shirt" size={64} color={theme.colors.borderStrong} strokeWidth={1.2} />
        </View>
      ) : (
        <Image
          source={{ uri: card.imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
      <View style={styles.label}>
        <View style={styles.labelText}>
          <Text style={styles.labelTitle} numberOfLines={1}>
            {card.title}
          </Text>
          <Text style={styles.labelSub} numberOfLines={1}>
            {styleFamilyLabels[card.family]}
          </Text>
        </View>
        {progress ? (
          <View style={styles.progress} testID="swipe-progress">
            <Text style={styles.progressText}>
              {tr.onboardingSwipeProgress(progress.current, progress.total)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The card that was just decided, flying off the screen. Purely visual. */
function LeavingCard({
  card,
  decision,
  fromX,
  width,
  screenWidth,
}: {
  card: StyleCard;
  decision: SwipeDecision;
  fromX: number;
  width: number;
  screenWidth: number;
}) {
  const x = useSharedValue(fromX);
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const direction = decision === 'Like' ? 1 : decision === 'Dislike' ? -1 : 0;
    if (direction === 0) {
      y.set(withTiming(-theme.sizes.swipeCardHeight, { duration: EXIT_MS }));
    } else {
      x.set(withTiming(direction * screenWidth, { duration: EXIT_MS }));
    }
    opacity.set(withTiming(0, { duration: EXIT_MS }));
  }, [decision, screenWidth, x, y, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.card, styles.leaving, { width }, style]}>
      <CardFace card={card} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  stack: {
    height: theme.sizes.swipeCardHeight,
  },
  card: {
    position: 'absolute',
    top: 0,
    height: theme.sizes.swipeCardHeight,
    borderRadius: theme.radius.xxl,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  behind: {
    transform: [{ scale: 0.94 }, { translateY: theme.spacing.md }],
  },
  leaving: {
    zIndex: 2,
  },
  face: {
    flex: 1,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  label: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.inkSoft,
  },
  labelText: {
    flex: 1,
    gap: 2,
  },
  labelTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.onInk,
  },
  labelSub: {
    ...theme.typography.caption,
    color: theme.colors.borderStrong,
  },
  progress: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkMuted,
  },
  progressText: {
    ...theme.typography.captionMedium,
    color: theme.colors.onInk,
  },
  stamp: {
    position: 'absolute',
    top: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    borderWidth: 3,
    backgroundColor: theme.colors.surface,
  },
  stampLike: {
    left: theme.spacing.xl,
    borderColor: theme.colors.accent,
  },
  stampNope: {
    right: theme.spacing.xl,
    borderColor: theme.colors.warning,
  },
  stampText: {
    ...theme.typography.heading,
  },
  stampTextLike: {
    color: theme.colors.accent,
  },
  stampTextNope: {
    color: theme.colors.warning,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xl,
  },
  button: {
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: {
    width: theme.sizes.swipeButtonLarge,
    height: theme.sizes.swipeButtonLarge,
  },
  buttonSmall: {
    width: theme.sizes.swipeButtonSmall,
    height: theme.sizes.swipeButtonSmall,
  },
  buttonOutline: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonLike: {
    backgroundColor: theme.colors.accent,
  },
});
