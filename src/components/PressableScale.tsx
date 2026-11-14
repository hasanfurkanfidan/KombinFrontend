import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Ease-out quart: fast start, soft landing, no bounce.
const easeOut = Easing.out(Easing.poly(4));

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  /** A plain style: the press feedback is the scale, so there is no `pressed` callback to style with. */
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * The press feedback of buttons and tiles: scales to 0.96 over 150 ms (ease-out) while held and back on release.
 * Nothing moves when the control is disabled or the OS asks for reduced motion.
 */
export function PressableScale({
  style,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const still = Boolean(disabled) || reduceMotion;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        if (!still) {
          // `set`/`get` instead of `.value`: the React Compiler lint treats `.value =` as a mutation.
          scale.set(
            withTiming(theme.motion.pressScale, {
              duration: theme.motion.pressMs,
              easing: easeOut,
            }),
          );
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: theme.motion.pressMs, easing: easeOut }));
        onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
