import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

/**
 * What appears after a vote (the win rate, the chosen card): it rises a little and fades in. With reduced motion nothing
 * moves: it only cross-fades.
 */
export function Reveal({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(160) : FadeInDown.duration(240)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
